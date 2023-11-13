const { pool } = require("../../config/db.config");



exports.create = async (req, res) => {
    const { address, post_code, location, type, platform_name, user_id, event_id } = req.body;

    if (!type) { 
        return res.status("type is required, type must be online or physical");
    }
    if (!event_id || !user_id) { 
        return res.status(404).json({ status: false, message: "user_id and event_id are required"})
    }
    try {
        if (type === "online") {
            if (!platform_name) {
                return res.status(404).json({ status: false, message: "platform_name is required" });
            }

            if (platform_name === "google") {
                // handle google

            }
            
            if (platform_name === "zoom") { 
                // handle zoom 
            }
        }

        else if (type === "physical") { 
            if (!address || !post_code, !location) { 
                return res.status(404).json({ status: false, message: "address, post_code, and  location are required!" });
            } 
            
        }
 
        else {
            return res.status(404).json({ status: false, message: "Invalid type"})
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: error.message})
    }
}
