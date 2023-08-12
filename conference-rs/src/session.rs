use actix::{Actor, StreamHandler};
use actix_web::{web::{self}, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use serde_json::Number;
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};
use actix::*;
use uuid::Uuid;

use crate::coordinator;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Serialize, Deserialize)]
struct WSRequest {
  msg_type: Option<String>,
  room_id: Option<String>,
  id: Option<String>,
  sdp: Option<String>,
  candidate: Option<String>,
  sdp_mline_index: Option<Number>,
  sdp_mid: Option<String>,
  username_fragment: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct WSCreateOffer {
  msg_type: String,
  id: String,
}

#[derive(Serialize, Deserialize)]
struct WSCreateAnswer {
  msg_type: String,
  id: String,
  sdp: String,
}

#[derive(Serialize, Deserialize)]
struct WSAcceptAnswer {
  msg_type: String,
  id: String,
  sdp: String,
}

#[derive(Serialize, Deserialize)]
struct WSAckAcceptAnswer {
  msg_type: String,
  id: String,
}

#[derive(Serialize, Deserialize)]
struct WSAddIceCandidate {
  msg_type: String,
  id: String,
  candidate: String,
  sdp_mline_index: Number,
  sdp_mid: String,
  username_fragment: String,
}

#[derive(Serialize, Deserialize)]
struct AddIceCandidateRequest {
  candidate: String,
  sdp_mline_index: Number,
  sdp_mid: String,
  username_fragment: String,
}

struct WSSession {
  id: String,
  room_id: String,
  coordinator_addr: Addr<coordinator::Coordinator>,
  last_hb: Instant,
}

impl WSSession {
  fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
    ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
      if Instant::now().duration_since(act.last_hb) > CLIENT_TIMEOUT {
        println!("Websocket Client heartbeat failed, disconnecting!");

        act.coordinator_addr.do_send(coordinator::Disconnect { id: act.id.clone() });

        ctx.stop();

        return;
      }

      ctx.ping(b"");
    });
}
}

impl Actor for WSSession {
  type Context = ws::WebsocketContext<Self>;

  fn started(&mut self, ctx: &mut Self::Context) {
    self.hb(ctx);
  }

  fn stopping(&mut self, _: &mut Self::Context) -> Running {
    self.coordinator_addr.do_send(coordinator::Disconnect{
      id: self.id.clone(),
    });
    Running::Stop
  }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WSSession {
  fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
    match msg {
      Ok(ws::Message::Ping(msg)) => {
        self.last_hb = Instant::now();
        ctx.pong(&msg);
      },
      Ok(ws::Message::Pong(_)) => {
        self.last_hb = Instant::now();
      },
      Ok(ws::Message::Text(text)) => {
        let message: WSRequest = serde_json::from_str(text.trim()).unwrap();
        let msg_type = message.msg_type.unwrap();
        match msg_type.as_str() {
          "joinRoom" => {
            let room_id = message.room_id.unwrap();
            self.room_id = room_id.clone();
            self.coordinator_addr
              .send(coordinator::Connect{
                id: self.id.clone(),
                room_id: room_id.clone(),
                addr: ctx.address().recipient(),
              })
              .into_actor(self)
              .then(|_, _, _| {
                fut::ready(())
              })
              .wait(ctx);
          }
          "createOffer" => {
            self.coordinator_addr.do_send(coordinator::ActionResponse{
              action_type: msg_type.to_string(),
              receiver_id: self.id.clone(),
              sender_id: message.id.unwrap(),
              room_id: self.room_id.clone(),
              content: message.sdp.unwrap(),
            });
          },
          "createAnswer" => {
            self.coordinator_addr.do_send(coordinator::ActionResponse{
              action_type: msg_type.to_string(),
              receiver_id: self.id.clone(),
              sender_id: message.id.unwrap(),
              room_id: self.room_id.clone(),
              content: message.sdp.unwrap(),
            });
          },
          "acceptAnswer" => {
            self.coordinator_addr.do_send(coordinator::ActionResponse{
              action_type: msg_type.to_string(),
              receiver_id: self.id.clone(),
              sender_id: message.id.unwrap(),
              room_id: self.room_id.clone(),
              content: "".to_string(),
            });
          },
          "addIceCandidate" => {
            let content = serde_json::to_string(&AddIceCandidateRequest{
              candidate: message.candidate.unwrap(),
              sdp_mline_index: message.sdp_mline_index.unwrap(),
              sdp_mid: message.sdp_mid.unwrap(),
              username_fragment: message.username_fragment.unwrap(),
            }).unwrap();
            self.coordinator_addr.do_send(coordinator::ActionResponse{
              action_type: msg_type.to_string(),
              receiver_id: self.id.clone(),
              sender_id: message.id.unwrap(),
              room_id: self.room_id.clone(),
              content: content,
            });
          },
          _ => (),
        }
      },
      Ok(ws::Message::Close(reason)) => {
        ctx.close(reason);
        ctx.stop();
      },
      Ok(ws::Message::Continuation(_)) => {
        ctx.stop();
      },
      _ => (),
    }
  }
}

impl Handler<coordinator::Action> for WSSession {
  type Result = ();

  fn handle(&mut self, msg: coordinator::Action, ctx: &mut Self::Context) {
    match msg.action_type.as_str() {
      "createOffer" => {
        ctx.text(serde_json::to_string(&WSCreateOffer{
          msg_type: msg.action_type,
          id: msg.id,
        }).unwrap());
      },
      "createAnswer" => {
        ctx.text(serde_json::to_string(&WSCreateAnswer{
          msg_type: msg.action_type,
          id: msg.id,
          sdp: msg.content,
        }).unwrap());
      },
      "acceptAnswer" => {
        ctx.text(serde_json::to_string(&WSAcceptAnswer{
          msg_type: msg.action_type,
          id: msg.id,
          sdp: msg.content,
        }).unwrap());
      },
      "ackAcceptAnswer" => {
        ctx.text(serde_json::to_string(&WSAckAcceptAnswer{
          msg_type: msg.action_type,
          id: msg.id,
        }).unwrap());
      },
      "addIceCandidate" => {
        let content: AddIceCandidateRequest = serde_json::from_str(&msg.content).unwrap();
        ctx.text(serde_json::to_string(&WSAddIceCandidate{
          msg_type: msg.action_type,
          id: msg.id,
          candidate: content.candidate,
          sdp_mline_index: content.sdp_mline_index,
          sdp_mid: content.sdp_mid,
          username_fragment: content.username_fragment,
        }).unwrap());
      },
      "removePeer" => {

      },
      _ => (),
    }
  }
}

pub async fn index(
  req: HttpRequest,
  stream: web::Payload,
  coordinator_addr: web::Data<Addr<coordinator::Coordinator>>,
) -> Result<HttpResponse, Error> {
  let id = Uuid::new_v4();
  let resp = ws::start(WSSession {
    id: id.to_string(),
    room_id: "".to_string(),
    last_hb: Instant::now(),
    coordinator_addr: coordinator_addr.get_ref().clone(),
  }, &req, stream);
  println!("{:?}", resp);
  resp
}
