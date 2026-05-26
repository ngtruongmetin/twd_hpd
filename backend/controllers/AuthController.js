const db = require("../utils/db");
const bcrypt = require("bcrypt");

class AuthController {
    static async Login(req, res) {

        let username = req.body.username;
        let password = req.body.password;

        let sql = `Select 
        Users.Username, 
        Users.Fullname, 
        Users.Address, 
        Users.SchoolName, 
        Users.WardName, 
        Users.ProvinceName, 
        Users.OrganizationPosition, 
        Users.Phone, 
        Users.Email, 
        Users.WorkUnit, 
        Roles.RoleName,
        Users.PasswordHash
        From Users 
        Inner Join Roles On Roles.RoleID = Users.RoleID 
        Where Username = ?`;

        db.get(sql, [username], async (err, row) => {
            console.log(err);
            if (err) return res.status(500).json({
                success: false,
                message: "Lỗi không thể truy vấn"
            });

            if ((await bcrypt.compare(password, row.PasswordHash))) console.log(1);

            if (row) return res.status(200).json({
                success: true,
                message: "Truy vấn thành công",
                data: row
            })

        });


    }

    static async Register(req, res) {
        let username = req.body.username;
        let password = req.body.password;
    }
}

AuthController.Login({
    body: {
        username: "baovn1179",
        password: "JSCoder20082"
    }
}, {
    status: function(e) {
        return {
            json: () => {}
        }
    }
});

module.exports = AuthController;