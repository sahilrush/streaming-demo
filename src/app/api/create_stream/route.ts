import { Controller } from "@/lib/controller";
import { CreateStreamParams } from "@/lib/types";
import { error } from "console";


export async function POST(req:Request) {
    const controller = new Controller();


    try{
        const reqBody = await req.json();
        const response = await controller.createStream(
            reqBody as CreateStreamParams
        );

        return Response.json(Response);
    }catch(err){
        if(err instanceof Error)
        return new Response(err.message, {status:500})
    }

    return new Response(null,{status:500})

}