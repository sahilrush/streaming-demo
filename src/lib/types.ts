import { IngressInfo } from "livekit-server-sdk";


export type Session = {
    identity: string;
    room_name:string
}


export type CreateIngressParams = {
    room_name: string;
    ingress_type:string;
    metadata: RoomMetaData;

}


export type RoomMetaData = {
    creator_identity:string
    enable_chat:boolean;
    allow_participation:boolean
}

export type CreateIngressResponse = {
    ingress:IngressInfo;
    auth_token:string;
    connection_details:ConnectionDetails;

}


export type  ConnectionDetails = {
    token:string;
    ws_url:string
}

export type CreateStreamParams = {
    room_name:string;
    metadata:RoomMetaData;
}


export type CreateStreamResponse = {
    auth_token:string;
    connection_details:ConnectionDetails;
}


export type JoinStreamParams = {
    room_name:string;
    identity:string;
}


export type JoinStreamResponse = {
    auth_token:string;
    connection_details:ConnectionDetails;
}

export type InviteToStageParams = {
    identity:string;
}

export type ParticipantMetadata = {
    hand_raised:boolean;
    invited_to_stage:boolean;
    avatar_image:string;
}


export type RemoveFromStageParams = {
    identity?:string
}