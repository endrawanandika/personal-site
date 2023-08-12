use actix::Actor;
use actix_web::{web::{self, Data}, App, HttpServer};

mod coordinator;
mod session;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
  let coordinator = coordinator::Coordinator::new().start();

  println!("start");

  HttpServer::new(move || 
    App::new()
      .app_data(Data::new(coordinator.clone()))
      .route("/ws/", web::get().to(session::index)))
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
