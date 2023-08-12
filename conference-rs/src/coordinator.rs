use actix::prelude::*;
use std::collections::HashMap;

#[derive(Message)]
#[rtype(result = "()")]
pub struct Action {
  pub action_type: String,  
  pub id: String,
  pub content: String,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct ActionResponse {
  pub action_type: String,
  pub room_id: String,
  pub sender_id: String,
  pub receiver_id: String,
  pub content: String,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Connect {
  pub id: String,
  pub room_id: String,
  pub addr: Recipient<Action>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
  pub id: String,
}

pub struct Coordinator {
  rooms: HashMap<String, HashMap<String, Recipient<Action>>>,
}

impl Coordinator {
  pub fn new() -> Coordinator {
    Coordinator {
      rooms: HashMap::new(),
    }
  }

  fn send_actions(&self, action_type: &str, room_id: &str, skip_user_id: &str) {
    if let Some(sessions) = self.rooms.get(room_id) {
      for (id, addr) in sessions {
        if *id != skip_user_id {
          let _ = addr.do_send(Action {
            action_type: action_type.to_string(),
            id: skip_user_id.to_string(),
            content: "".to_string(),
          });
        }
      }
    }
  }
}

impl Actor for Coordinator {
  type Context = Context<Self>;
}

impl Handler<ActionResponse> for Coordinator {
  type Result = ();

  fn handle(&mut self, msg: ActionResponse, _: &mut Context<Self>) {
    println!("Someone response action");

    match msg.action_type.as_str() {
      "createOffer" => {
        let addr = self.rooms.get(&msg.room_id).unwrap().get(&msg.sender_id).unwrap();
        addr.do_send(Action {
          action_type: "createAnswer".to_string(),
          id: msg.receiver_id.clone(),
          content: msg.content.clone(),
        });
      },
      "createAnswer" => {
        let addr = self.rooms.get(&msg.room_id).unwrap().get(&msg.sender_id).unwrap();
        addr.do_send(Action {
          action_type: "acceptAnswer".to_string(),
          id: msg.receiver_id.clone(),
          content: msg.content.clone(),
        });
      },
      "acceptAnswer" => {
        let addr = self.rooms.get(&msg.room_id).unwrap().get(&msg.sender_id).unwrap();
        addr.do_send(Action {
          action_type: "ackAcceptAnswer".to_string(),
          id: msg.receiver_id.clone(),
          content: msg.content.clone(),
        });
      },
      "addIceCandidate" => {
        let addr = self.rooms.get(&msg.room_id).unwrap().get(&msg.sender_id).unwrap();
        addr.do_send(Action {
          action_type: "addIceCandidate".to_string(),
          id: msg.receiver_id.clone(),
          content: msg.content.clone(),
        });
      },
      _ => (),
    }
  }
}

impl Handler<Connect> for Coordinator {
  type Result = ();

  fn handle(&mut self, msg: Connect, _: &mut Context<Self>) {
    println!("Someone connected");

    let user_id = msg.id;
    let room_id = msg.room_id;

    self.rooms
      .entry(room_id.clone())
      .or_insert_with(HashMap::new)
      .insert(user_id.clone(), msg.addr);

    self.send_actions("createOffer", &room_id, &user_id);
  }
}

impl Handler<Disconnect> for Coordinator {
  type Result = ();

  fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
    println!("Someone disconnected");

    let user_id = msg.id;
    let mut room_ids: Vec<String> = Vec::new();

    for (room_id, sessions) in &mut self.rooms {
      if sessions.remove(&user_id).is_some() {
        room_ids.push(room_id.to_owned())
      }
    }
  
    for room_id in room_ids {
      self.send_actions("removePeer", &room_id, &user_id);
    }
  }
}
