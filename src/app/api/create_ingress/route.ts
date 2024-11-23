import { Controller } from "@/lib/controller";
import { CreateIngressParams } from "@/lib/types";



export async function POST(req:Request) {
    const controller = new Controller();
    try{
        const reqBody = await req.json();
        const response = await controller.createIngress(
            reqBody as CreateIngressParams
        );
        return Response.json(response);

    }catch(err) {
        console.log(err);

        if(err instanceof Error) {
            return new Response(err.message, {status: 500})
        }
        return new Response(null, {status:500})

    }
}