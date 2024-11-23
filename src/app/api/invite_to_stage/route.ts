import { Controller } from "@/lib/controller";
import { getSession } from "@/lib/middleware";
import { InviteToStageParams } from "@/lib/types";



export async function POST(req:Request) {
    const controller = new Controller();

    try{
        const session = getSession(req);
        const reqBody = await req.json();
        await controller.inviteToStage(session, reqBody as InviteToStageParams);

        return Response.json({});

    } catch (err) {
        if (err instanceof Error) {
          return new Response(err.message, { status: 500 });
        }
        return new Response(null, { status: 500 });
      }
}