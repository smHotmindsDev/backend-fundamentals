import * as z from "zod";

const User = z.object({
    username: z.string(),
    password: z.string()
});

const validateUser = (username, password) => {
    try {
        User.parse({ username: username, password: password });
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

export default validateUser;