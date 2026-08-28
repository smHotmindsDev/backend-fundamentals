import * as z from "zod";

const JsonInputText = z.object({
    data: z.object({
        text: z.string()
    })
})
const validateLoremJson = (data) => {
    try {
        JsonInputText.parse({ data: data });
        return {
            success: true,
        };
    } catch(error){
        if(error instanceof z.ZodError){
            console.error(error.issues)
            return { success: false, error: error.issues };
        }

        return { success: false, error: 'Internal error' };
    }
}

export default validateLoremJson;