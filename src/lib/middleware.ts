import { Session } from "./types";
import jwt from "jsonwebtoken"; 


export function getSession(req: Request): Session {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];
    if (!token) {
        throw new Error("No authorization header found");
    }
    const verified = jwt.verify(token, process.env.LIVEKIT_API_SECRET!);

    if (!verified) {
        throw new Error("invalid token")
    }

    const decoded = jwt.decode(token) as Session;
    return decoded;

}