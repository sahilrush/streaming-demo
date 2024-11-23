import {
    CreateIngressParams,
    CreateIngressResponse,
    Session,
    CreateStreamParams,
    CreateStreamResponse,
    RoomMetaData,
    JoinStreamParams,
    JoinStreamResponse,
    InviteToStageParams,
    ParticipantMetadata,
    RemoveFromStageParams,
} from "./types";
import jwt from "jsonwebtoken";
import {
    AccessToken,
    CreateIngressOptions,
    IngressAudioEncodingPreset,
    IngressAudioOptions,
    IngressClient,
    IngressInput,
    IngressVideoEncodingPreset,
    IngressVideoOptions,
    ParticipantInfo,
    ParticipantPermission,
    RoomServiceClient,
    TrackSource,
} from "livekit-server-sdk";

export class Controller {
    private ingressService: IngressClient;
    private roomService: RoomServiceClient;

    constructor() {
        const httpUrl = process.env.LIVEKIT_WS_URL!
            .replace("wss://", "http://")
            .replace("ws://", "http://");
        this.ingressService = new IngressClient(httpUrl);
        this.roomService = new RoomServiceClient(
            httpUrl,
            process.env.LIVEKIT_API_KEY!,
            process.env.LIVEKIT_API_SECRET!
        );
    }


    

    async createIngress({
        metadata,
        room_name,
        ingress_type = "rtmp",
    }: CreateIngressParams): Promise<CreateIngressResponse | undefined> {
        if (!room_name) {
            room_name = generateRoomId();
        }

        // Create room
        await this.roomService.createRoom({
            name: room_name,
            metadata: JSON.stringify(metadata),
        });

        const options: CreateIngressOptions = {
            name: room_name,
            roomName: room_name,
            participantIdentity: `${metadata.creator_identity}(via OBS)`,
            participantName: `${metadata.creator_identity}(via OBS)`,
        };

        if (ingress_type === "whip") {
            options.bypassTranscoding = true;
        } else {
            options.video = new IngressVideoOptions({
                name: "",
                source: TrackSource.CAMERA,
                encodingOptions: {
                    case: "preset",
                    value: IngressVideoEncodingPreset.H264_1080P_30FPS_3_LAYERS,
                },
            });

            options.audio = new IngressAudioOptions({
                name: "",
                source: TrackSource.MICROPHONE,
                encodingOptions: {
                    case: "preset",
                    value: IngressAudioEncodingPreset.OPUS_STEREO_96KBPS,
                },
            });

            const ingress = await this.ingressService.createIngress(
                ingress_type === "whip"
                    ? IngressInput.WHIP_INPUT
                    : IngressInput.RTMP_INPUT,
                options
            );

            const accToken = new AccessToken(
                process.env.LIVEKIT_API_KEY!,
                process.env.LIVEKIT_API_SECRET!,
                {
                    identity: metadata.creator_identity,
                }
            );

            accToken.addGrant({
                room: room_name,
                roomJoin: true,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
            });

            const authToken = this.createAuthToken(room_name, metadata.creator_identity);

            return {
                ingress,
                auth_token: authToken,
                connection_details: {
                    ws_url: process.env.LIVEKIT_WS_URL!,
                    token: await accToken.toJwt(),
                },
            };
        }
    }

    async createStream({
        metadata,
        room_name: roomName,
    }: CreateStreamParams): Promise<CreateStreamResponse | undefined> {
        const accToken = new AccessToken(
            process.env.LIVEKIT_API_KEY!,
            process.env.LIVEKIT_API_SECRET!,
            {
                identity: metadata.creator_identity
            }
        )

        if (!roomName) {
            roomName = generateRoomId();
        }
        accToken.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        })


        await this.roomService.createRoom({
            name: roomName,
            metadata: JSON.stringify(metadata),
        })

        const connection_details = {
            ws_url: process.env.LIVEKIT_WS_URL!,
            token: await accToken.toJwt(),

        };


        const auth_token = this.createAuthToken(roomName, metadata.creator_identity);
        return {
            auth_token: auth_token,
            connection_details: connection_details,
        }
    }


    async stopStream(session: Session) {
        const rooms = await this.roomService.listRooms([session.room_name]);

        if (rooms.length === 0) {
            throw new Error("Room not found");
        }
        const room = rooms[0];
        const creator_identity = (JSON.parse(room.metadata) as RoomMetaData).creator_identity;

        if (creator_identity !== session.identity) {
            throw new Error("You are not the creator of this room");
        }

        await this.roomService.deleteRoom(session.room_name);

    }

    async joinStream({ identity, room_name }: JoinStreamParams): Promise<JoinStreamResponse> {
        let exists = false;
        try {
            await this.roomService.getParticipant(room_name, identity);
            exists = true;
        } catch { }


        if (exists) {
            throw new Error("Participant already exists");
        }

        const accToken = new AccessToken(
            process.env.LIVEKIT_API_KEY!,
            process.env.LIVEKIT_API_SECRET!,
            {
                identity,
            }
        )

        accToken.addGrant({
            room: room_name,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,

        })

        const authToken = this.createAuthToken(room_name, identity);

        return {
            auth_token: authToken,
            connection_details: {
                ws_url: process.env.LIVEKIT_WS_URL!,
                token: await accToken.toJwt(),
            },
        }


    }

    async inviteToStage(session: Session, { identity }: InviteToStageParams) {
        const rooms = await this.roomService.listRooms([session.room_name]);

        if (rooms.length === 0) {
            throw new Error("Room does not exist");
        }

        const room = rooms[0];
        const creator_identity = (JSON.parse(room.metadata) as RoomMetaData).creator_identity;

        if (creator_identity !== session.identity) {
            throw new Error("only creator can invite others to stage");
        }

        const participant = await this.roomService.getParticipant(
            session.room_name,
            identity
        );
        const permission = participant.permission || ({} as ParticipantPermission)

        const metadata = this.getOrCreateParticipantMetadata(participant);
        metadata.invited_to_stage = true;


        if (metadata.hand_raised) {
            permission.canPublish = true
        }

        await this.roomService.updateParticipant(
            session.room_name,
            identity,
            JSON.stringify(metadata),
            permission
        )
    }


    async removeFromStage(session: Session, { identity }: RemoveFromStageParams) {
        if (!identity) {
            identity = session.identity;
        }

        const rooms = await this.roomService.listRooms([session.room_name]);

        if (rooms.length === 0) {
            throw new Error("Room does not exist")
        }

        const room = rooms[0]
        const creator_identity = (JSON.parse(room.metadata) as RoomMetaData).creator_identity;

        if (creator_identity !== session.identity && identity !== session.identity) {
            throw new Error("only the creator or the participant himself can remove from stage")
        };

        const participant = await this.roomService.getParticipant(
            session.room_name,
            session.identity

        )

        const permission = participant.permission || ({} as ParticipantPermission);
        const metadata = this.getOrCreateParticipantMetadata(participant);

        metadata.hand_raised = false;
        metadata.invited_to_stage = false;
        permission.canPublish = false;

        await this.roomService.updateParticipant(
            session.room_name,
            identity,
            JSON.stringify(metadata),
            permission

        )

    }


    async raiseHand(session: Session) {
        const participant = await this.roomService.getParticipant(
            session.room_name,
            session.identity
        );

        const permission = participant.permission || ({} as ParticipantPermission);
        const metadata = this.getOrCreateParticipantMetadata(participant)
        metadata.hand_raised = true;

        if(metadata.invited_to_stage) {
            permission.canPublish = true
        }

        await this.roomService.updateParticipant(
            session.room_name,
            session.identity,
            JSON.stringify(metadata),
            permission

        )

    }


    getOrCreateParticipantMetadata(
        participant: ParticipantInfo
    ): ParticipantMetadata {
        if (participant.metadata) {
            return JSON.parse(participant.metadata) as ParticipantMetadata;
        }
        return {
            hand_raised: false,
            invited_to_stage: false,
            avatar_image: `https://api.multiavatar.com/${participant.identity}.png`,
        };

    }


    createAuthToken(room_name: string, identity: string) {
        return jwt.sign(
            JSON.stringify({ room_name, identity }),
            process.env.LIVEKIT_API_SECRET!
        );
    }
}

function generateRoomId() {
    return `${randomString(4)}-${randomString(4)}`;
}

function randomString(length: number) {
    let result = "";
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

