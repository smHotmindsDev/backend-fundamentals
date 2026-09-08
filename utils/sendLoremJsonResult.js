import ServerError from "./ServerError.js";

const sendLoremJsonResult = (res, isValid, payload) => {
    if (isValid.success) {
        return res.status(200).json(payload)
    } else {
        return res.status(422).json({
            "status": "invalid json",
            "message" : isValid.error
        })
    }
}

export default sendLoremJsonResult;