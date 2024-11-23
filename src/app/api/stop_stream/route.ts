import { Controller } from "@/lib/controller";
import { getSession } from "@/lib/middleware";




export async function POST(req:Request) {
    const controller = new Controller();

    try{
        const session = getSession(req);
        await controller.stopStream(session)

    }
catch (err) {
    if (err instanceof Error) {
      return new Response(err.message, { status: 500 });
    }

    return new Response(null, { status: 500 });
  }
}