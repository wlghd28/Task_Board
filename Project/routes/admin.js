const   fs          = require('fs');
const   express     = require('express');
const   ejs         = require('ejs');
const   mysql       = require('mysql');
const   bodyParser  = require('body-parser');
const   methodOverride = require('method-override');
//const   session     = require('express-session');
const   router      = express.Router();
//const   requestIp   = require('request-ip');
const   moment      = require('moment');
const   async       = require('async');
require('moment-timezone');

router.use(methodOverride('_method'));
router.use(bodyParser.urlencoded({ extended: false }));

/* 
    데이터베이스 연동 소스코드 
*/
var db = mysql.createConnection({
    host:       'localhost',        // DB서버 IP주소
    port:       3306,               // DB서버 Port주소
    user:       'root',             // DB접속 아이디
    password:   'root',             // DB암호
    database:   'Task_Board'        //사용할 DB명
});

function HandleDisconnectDB() {
    db = mysql.createConnection({       // Recreate the connection, since
        host:       'localhost',        // DB서버 IP주소
        port:       3306,               // DB서버 Port주소
        user:       'root',             // DB접속 아이디
        password:   'root',             // DB암호
        database:   'Task_Board'        //사용할 DB명
    });

    // the old one cannot be reused.
    db.connect(function(err) {              // The server is either down
        if(err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(HandleDisconnectDB, 2000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
    });                                         // process asynchronous requests in the meantime.

    // If you're also serving http, display a 503 error.
    db.on('error', function(err) {
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            HandleDisconnectDB();                         // lost due to either server restart, or a
        } else {                                        // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });

}

HandleDisconnectDB();

/*
    관리자 메인화면
*/
const MainUI = (req, res) => {
    if (req.session.admin) {  
        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header_admin.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/adminbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/admin_main.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        res.end(ejs.render(HtmlPageStream, {
            'title'         :'Task Board',
            level           :req.session.level,
            src_url         :'../'
        }));
    } else {
        res.redirect('/');
    }
};

/*
    유저관리
*/
const ManageUserUI = (req, res) => {
    if (req.session.admin) {  
        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header_admin.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/adminbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/admin_manageuser.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});


        let str_sql = "SELECT * FROM USER WHERE user_id != 'admin';"

        db.query(str_sql, (error, results) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
                res.end(ejs.render(HtmlPageStream, {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    src_url         :'../',
                    User            :results
                }));              
            }
        });
    } else {
        res.redirect('/');
    }
};

/*
    유저추가
*/
const AddUserUI = (req, res) => {
    if (req.session.admin) {  
        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header_admin.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/adminbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/admin_adduser.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        res.end(ejs.render(HtmlPageStream, {
            'title'         :'Task Board',
            level           :req.session.level,
            src_url         :'../'
        }));
    } else {
        res.redirect('/');
    }
};

const AddUser = (req, res) => {
    if (req.session.admin) {  
        let body = req.body;
        let sql_str_search            = 'SELECT * FROM USER WHERE user_id=?';
        let sql_str_insert            = 'INSERT INTO USER(user_id, user_pwd, user_name, user_team, user_level) VALUES(?, ?, ?, ?, ?)';
        let sql_str_notification      = 'INSERT INTO NOTICE_BOARD_NOTIFICATION(notification_userid, notification_alarm) VALUES(?, ?)';
        let userid              = body.userid;
        let username            = body.username;
        let password            = body.pw1;
        let confirm_password    = body.pw2;
        let user_team         = body.team;

        db.query(sql_str_search, [userid], (error, results) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
                // 입력받은 데이터가 DB에 존재하는지 판단합니다. 
                if (results[0] == undefined && password == confirm_password) {
                    db.query(sql_str_insert, [userid, password, username, user_team, 0], (error) => {
                        if (error) {
                            res.end("error");
                            console.log(error);
                        } else {
                            // 게시글 알람에 대한 DB 정보도 추가해준다.
                            db.query(sql_str_notification, [userid, 1], (error) => {
                                if (error) {
                                    res.end("alarm error");
                                    console.log(error);
                                } else {                                  
                                }
                            }); // db.query();
                            
                            console.log('유저 추가 성공!!');
                            res.redirect('/admin/manageuser');

                        }
                    }); // db.query();
                } else {
                    let handleSignUpErrorHtmlStream = '';
                    // handleSignUpErrorHtmlStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');
                    handleSignUpErrorHtmlStream += fs.readFileSync(__dirname + '/../views/alert.ejs','utf8');
                    // handleSignUpErrorHtmlStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8');
                    res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
            
                    res.status(562).end(ejs.render(handleSignUpErrorHtmlStream, {
                                                                    'title' : 'error',
                                                                    'error' : '중복된 ID가 있습니다!!'
                                                                }));  
                }              
            }
        });
    
    } else {
        res.redirect('/');
    }
};


/*
    유저정보변경
*/
const AlterUserInfo = (req, res) => {
    if (req.session.admin) {  
        let body = req.body;
        let str_sql = "UPDATE USER SET user_level = ?, user_team = ? WHERE user_id = ?"

        //console.log(body);

        db.query(str_sql, [body.selected_level, body.selected_team, body.userid], (error) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
               console.log("유저 정보 DB수정 성공!!");
               res.redirect('/admin/manageuser');
            }
        });
    
    } else {
        res.redirect('/');
    }
};


/*
    유저삭제
*/
const DeleteUser = (req, res) => {
    if (req.session.admin) {  
        let body = req.body;

        //console.log(body);

        async.waterfall([
            // 해당 유저가 기록한 노트 데이터들의 id, name 정보를 삭제된 유저로 변경
            function(callback) {
                let str_sql_note = "UPDATE NOTE SET note_userid = 'DelUser', note_username = 'DelUser' WHERE note_userid = ?";
                db.query(str_sql_note, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });  
            },
            // 해당 유저가 제출한 보고서 데이터들의 id, name 정보를 삭제된 유저로 변경
            function(callback) {
                let str_sql_report = "UPDATE REPORT SET report_userid = 'DelUser', report_username = 'DelUser' WHERE report_userid = ?";
                db.query(str_sql_report, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });  
            },
            // 해당 유저가 작성한 게시판 글들의 id, name 정보를 삭제된 유저로 변경
            function(callback) {
                let str_sql_notice_board = "UPDATE NOTICE_BOARD SET notice_userid = 'DelUser', notice_username = 'DelUser' WHERE notice_userid = ?";
                db.query(str_sql_notice_board, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });  
            },
             // 해당 유저가 달았던 댓글들의 id, name 정보를 삭제된 유저로 변경
             function(callback) {
                let str_sql_notice_board_comment = "UPDATE NOTICE_BOARD_COMMENT SET comment_userid = 'DelUser', comment_username = 'DelUser' WHERE comment_userid = ?";
                db.query(str_sql_notice_board_comment, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });     
            },
            // 해당 유저가 달았던 답글들의 id, name 정보를 삭제된 유저로 변경
            function(callback) {
                let str_sql_notice_board_reply = "UPDATE NOTICE_BOARD_REPLY SET reply_userid = 'DelUser', reply_username = 'DelUser' WHERE reply_userid = ?";    
                db.query(str_sql_notice_board_reply, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });    
            },
            // 해당 유저가 보낸 메시지들의 id, name 정보를 삭제된 유저로 변경
            function(callback) {
                let str_sql_message = "UPDATE MESSAGE SET message_userid = 'DelUser', message_username = 'DelUser' WHERE message_userid = ?";         
                db.query(str_sql_message, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });    
            },
            // 해당 유저가 받은 메시지들의 id, name 정보를 삭제된 유저로 변경
            function(callback) {
                let str_sql_message_receiver = "UPDATE MESSAGE_RECEIVER SET receiver_userid = 'DelUser', receiver_username = 'DelUser' WHERE receiver_userid = ?";         
                db.query(str_sql_message_receiver, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });    
            },
            // 게시글 알람 table에서 해당 유저 삭제
            function(callback) {
                let str_sql_notification = "DELETE FROM NOTICE_BOARD_NOTIFICATION WHERE notification_userid = ?";
                db.query(str_sql_notification, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null); 
                    }
                });  
            },
            // user table에서 해당 유저 삭제
            function(callback) {
                let str_sql_user = "DELETE FROM USER WHERE user_id = ?";           
                db.query(str_sql_user, [body.userid], (error) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        callback(null);                   
                    }
                });
            },
            function(callback) {
                console.log("유저 정보 DB삭제 성공!!");
                res.redirect('/admin/manageuser');
                callback(null);   
            }
        ],  function(error) {
            if (error) 
            {
                console.log(error);
                res.end("error");
            }
        });

   
    } else {
        res.redirect('/');
    }
};


router.get('/', MainUI);
router.get('/manageuser', ManageUserUI);
router.get('/adduser', AddUserUI);
router.post('/adduser', AddUser);
router.put('/alteruserinfo', AlterUserInfo);
router.delete('/deleteuser', DeleteUser);


module.exports = router