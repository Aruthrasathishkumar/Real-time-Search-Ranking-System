package com.recommendation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.MapFunction;
import org.apache.flink.api.common.functions.ReduceFunction;
import org.apache.flink.api.java.tuple.Tuple3;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.functions.sink.SinkFunction;
import org.apache.flink.streaming.api.windowing.assigners.TumblingProcessingTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;
import redis.clients.jedis.Jedis;

public class ClickStreamJob {

    public static void main(String[] args) throws Exception {

        // PART 1: Create the Flink execution environment
        // This is like creating an Express app — it is the container for everything
        StreamExecutionEnvironment env =
            StreamExecutionEnvironment.getExecutionEnvironment();
        
        // PART 2: Connect to Kafka and read click events
        // KafkaSource is Flink's built-in Kafka reader
        KafkaSource<String> kafkaSource = KafkaSource.<String>builder()
            .setBootstrapServers("localhost:9092")
            .setTopics("user-clicks")
            .setGroupId("flink-click-processor")
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new SimpleStringSchema())
            .build();

        // Create a stream from Kafka — events flow in here continuously
        DataStream<String> rawStream = env.fromSource(
            kafkaSource,
            WatermarkStrategy.noWatermarks(),
            "Kafka Source"
        );

        // PART 3: Parse each JSON event into a Tuple3
        // Tuple3 is just a container holding 3 values: (query, itemId, score)
        // We give every click a base score of 1.0 — Flink will sum them up
        ObjectMapper mapper = new ObjectMapper();

        DataStream<Tuple3<String, String, Double>> clickStream = rawStream
            .map(new MapFunction<String, Tuple3<String, String, Double>>() {
                @Override
                public Tuple3<String, String, Double> map(String json) {
                    try {
                        JsonNode node = mapper.readTree(json);
                        String query  = node.get("query").asText();
                        String itemId = node.get("itemId").asText();
                        // Each click starts with score 1.0
                        return Tuple3.of(query, itemId, 1.0);
                    } catch (Exception e) {
                        // If JSON is invalid, return a dummy tuple to skip it
                        return Tuple3.of("unknown", "unknown", 0.0);
                    }
                }
            })
            // Filter out invalid events
            .filter(t -> !t.f0.equals("unknown"));

        // PART 4: Group by (query + itemId) and count in 30-second windows
        // keyBy groups all clicks for the same (query, itemId) together
        // timeWindow aggregates them every 30 seconds
        DataStream<Tuple3<String, String, Double>> scoredStream = clickStream
            .keyBy(t -> t.f0 + ":" + t.f1)
            .window(TumblingProcessingTimeWindows.of(Time.seconds(30)))
            .reduce(new ReduceFunction<Tuple3<String, String, Double>>() {
                @Override
                public Tuple3<String, String, Double> reduce(
                    Tuple3<String, String, Double> a,
                    Tuple3<String, String, Double> b) {
                    // Sum the scores — this counts total clicks in the window
                    return Tuple3.of(a.f0, a.f1, a.f2 + b.f2);
                }
            });

        // PART 5: Write scores to Redis
        // This runs after every 30-second window closes
        scoredStream.addSink(new SinkFunction<Tuple3<String, String, Double>>() {
            @Override
            public void invoke(Tuple3<String, String, Double> scored) {
                String query  = scored.f0;
                String itemId = scored.f1;
                double score  = scored.f2;

                // Connect to Redis
                try (Jedis jedis = new Jedis("localhost", 6379)) {
                    // Write to variant A key (recency weighted)
                    jedis.zadd(query + ":A", score, itemId);
                    jedis.expire(query + ":A", 3600);

                    // Write to variant B key (same score for now)
                    jedis.zadd(query + ":B", score, itemId);
                    jedis.expire(query + ":B", 3600);

                    System.out.println("Updated Redis: " + query +
                        " -> " + itemId + " score=" + score);
                }
            }
        });

        // Start the Flink job — this runs forever until you stop it
        env.execute("Click Stream Ranking Job");
    }
}
