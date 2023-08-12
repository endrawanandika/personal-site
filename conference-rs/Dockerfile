FROM rust:latest as builder

WORKDIR /app
COPY . /app
RUN cargo build --bins --release

CMD ["/app/target/release/conference-rs"]

# FROM alpine:latest

# COPY --from=builder /app/target/release/conference-rs /app/conference-rs
# CMD ["/app/conference-rs"]
