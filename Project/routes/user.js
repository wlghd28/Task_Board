const   fs          = require('fs');
const   express     = require('express');
const   ejs         = require('ejs');
const   mysql       = require('mysql');
const   bodyParser  = require('body-parser');
const   methodOverride = require('method-override');
//const   session     = require('express-session');
const   router      = express.Router();
//const   requestIp   = require('request-ip');
const   multipart = require('connect-multiparty');
const   multipartMiddleware = multipart();
const   moment      = require('moment');
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
    로그인을 처리합니다.
*/
const HandleLogin = (req, res) => {
    let body = req.body; // body에 login.ejs 폼으로부터 name값 value값이 객체 형식으로 넘어옴 {uid: '어쩌고', pass: '저쩌고'}
    let userid, userpass, username, userlevel, userteam;
    let sql_str;
    //let sql_str2;
    //let ip_address;
    let handleLoginErrorHtmlStream = '';
    moment.tz.setDefault("Asia/Seoul");
    
    // handleLoginErrorHtmlStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');
    handleLoginErrorHtmlStream += fs.readFileSync(__dirname + '/../views/alert.ejs','utf8');
    // handleLoginErrorHtmlStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8');  

    if (body.uid == '' || body.pass == '') {
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        res.status(562).end(ejs.render(handleLoginErrorHtmlStream, {
                                                                    'title' : 'error',
                                                                    'url'   : '/',
                                                                    'error' : '로그인오류'
                                                                    // 'warn_title' : '로그인오류',
                                                                    // 'return_url'   : '../user/login',
                                                                    // 'warn_message' : '로그인을 처리하는 도중'
                                                                }));  
    } else {
        sql_str = "SELECT * FROM USER WHERE user_id=? AND user_pwd=?;";
        //sql_str2 = "INSERT INTO LOGIN_LOG(date, user_id, user_name, ip_address) VALUES(?, ?, ?, ?)";
        
        db.query(sql_str, [body.uid, body.pass], (error, results, fields) => {
            if (error) {
                res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
                res.status(562).end(ejs.render(handleLoginErrorHtmlStream, {
                                                                            'title' : 'error',
                                                                            'url'   : '/',
                                                                            'error' : '로그인오류'
                                                                            // 'warn_title' : '로그인오류',
                                                                            // 'return_url'   : '../user/login',
                                                                            // 'warn_message' : '로그인을 처리하는 도중'
                                                                        }));  
                console.log(error); 
            } else {
                if (results.length <= 0) {  // select 조회결과가 없는 경우 (즉, 등록계정이 없는 경우)
                    res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
                    res.status(562).end(ejs.render(handleLoginErrorHtmlStream, {
                                                                                'title' : 'error',
                                                                                'url'   : '/',
                                                                                'error' : '로그인오류'
                                                                                // 'warn_title' : '로그인오류',
                                                                                // 'return_url'   : '../user/login',
                                                                                // 'warn_message' : '로그인을 처리하는 도중'
                                                                            }));  
                } else {  // select 조회결과가 있는 경우 (즉, 등록된 계정이 존재하는 경우)
                    //console.log("results: ", results);  
                    results.forEach((user_data, index) => { // results는 db로부터 넘어온 key와 value를 0번째 방에 객체로 저장함
                        userid    = user_data.user_id;  
                        userpass  = user_data.user_pwd; 
                        username  = user_data.user_name;
                        userlevel = user_data.user_level;
                        userteam  = user_data.user_team;
                        //console.log("DB에서 로그인성공한 ID/암호 : %s/%s", userid, userpass);

                        // 로그인이 성공한 경우
                        if (body.uid == userid && body.pass == userpass) {
                            req.session.auth    = 99;      // 임의로 수(99)로 로그인성공했다는 것을 설정함
                            req.session.userid  = userid; 
                            req.session.who     = username; // 인증된 사용자명 확보 (로그인후 이름출력용)
                            req.session.level   = userlevel;
                            req.session.team    = userteam;
                            
                            // 만약, 인증된 사용자가 관리자(admin)라면 이를 표시
                            if (body.uid == 'admin') {    
                                req.session.admin = true;
                                res.redirect('/admin');
                            } else {
                                res.redirect('/note');
                            }
                        }
                    }); // foreach 
                } // else
            }  // else
        });
   } // else
};

/*
    로그아웃을 처리합니다.
*/
const HandleLogout = (req, res) => {
    req.session.destroy();          // 세션을 완전히 제거하여 인증오작동 문제를 해결
    res.redirect('/');    // 로그아웃후 로그인 화면으로 재접속
    //console.log('로그아웃 완료!!');
}

/*
    회원가입 페이지를 출력합니다.
*/
const GetSignupPage = (req, res) => {
    let signUpPageHtmlStream = ''; 

    signUpPageHtmlStream += fs.readFileSync(__dirname + '/../views/header_login.ejs','utf8'); 
    signUpPageHtmlStream += fs.readFileSync(__dirname + '/../views/signup.ejs','utf8'); 
    signUpPageHtmlStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 

    res.writeHead(200, {'Content-Type':'text/html; charset=utf8'}); // 200은 성공
    res.end(ejs.render(signUpPageHtmlStream, {
                                                'title' : '회원가입',
                                                src_url : '../'
                                            }));
};

/*
    회원가입을 처리합니다.
*/
const HandleSignup = (req, res) => {
    //console.log('회원가입 요청 보냄');
    let sql_str1            = 'SELECT * FROM USER WHERE user_id=?';
    let sql_str2            = 'INSERT INTO USER(user_id, user_pwd, user_name, user_team, user_level) VALUES(?, ?, ?, ?, ?)';
    let sql_str3            = 'INSERT INTO NOTICE_BOARD_NOTIFICATION(notification_userid, notification_alarm) VALUES(?, ?)';
    let body                = req.body;
    let userid              = body.userid;
    let username            = body.username;
    let password            = body.pw1;
    let confirm_password    = body.pw2;
    let user_team         = body.team;

    // console.log(req.body);
    // console.log('POST 데이터 받음');

    db.query(sql_str1, [userid], (error, results) => {
        if (error) {     
            console.log(error);
            res.end("error");
        } else {
            // 입력받은 데이터가 DB에 존재하는지 판단합니다. 
            if (results[0] == undefined && password == confirm_password) {
                db.query(sql_str2, [userid, password, username, user_team, 0], (error) => {
                    if (error) {
                        res.end("error");
                        console.log(error);
                    } else {
                        console.log('Insertion into DB was completed!');
                        let signUpSucessPageHtmlStream = '';
                        // signUpSucessPageHtmlStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');
                        signUpSucessPageHtmlStream += fs.readFileSync(__dirname + '/../views/signup_success.ejs','utf8');
                        // signUpSucessPageHtmlStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8');
                        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

                         // 게시글 알람에 대한 DB 정보도 추가해준다.
                         db.query(sql_str3, [userid, 1], (error) => {
                            if (error) {
                                res.end("alarm error");
                                console.log(error);
                            } else {
                              
                            }
                        }); // db.query();
                        
                        res.status(562).end(ejs.render(signUpSucessPageHtmlStream, {
                                                                        'title' : '회원가입 완료',
                                                                        'massage' : '회원가입이 완료되었습니다.'
                                                                    }));
                        
            

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
};

/*
    ID 찾기 페이지를 출력합니다.
*/
/*
const GetFindIdPage = (req, res) => {
    
};
*/
/*
    ID 찾기를 처리합니다.
*/
/*
const HandleFindId = (req, res) => {
    
};
*/
/*
    Password 찾기 페이지를 출력합니다.
*/
/*
const GetFindPwdPage = (req, res) => {
    
};
*/
/*
    Password 변경 페이지를 출력합니다. 
*/
/*
// Password를 찾기위해 데이터를 입력 시 바로 변경 페이지로 이동합니다.
const GetAlterPwdPage = (req, res) => {
    
};
*/

/*
    Password 변경을 처리합니다.
*/
/*
const HandleAlterPwd = (req, res) => {
  
};
*/


const GetMyinfo = (req, res) => {
    if (req.session.userid) {  

        let sql_str = 'SELECT * FROM USER WHERE user_id = ?';
        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/myinfo.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        db.query(sql_str, [req.session.userid], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {
                res.end(ejs.render(HtmlPageStream, {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../',
                    Myinfo          :results[0]
                }));
            }
        });
    } else {
        res.redirect('/');
    }
};


const AlterPasswordUI = (req, res) => {
    if (req.session.userid) {  

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/alterpassword.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        res.end(ejs.render(HtmlPageStream, {
            'title'         :'Task Board',
            level           :req.session.level,
            userid          :req.session.userid,
            src_url         :'../../'
        }));
        
    } else {
        res.redirect('/');
    }
};

const AlterPassword = (req, res) => {
    if (req.session.userid) { 
        let body = req.body; 
        let user_id = req.session.userid;

        //console.log(body);

        let str_sql_confirm = "SELECT user_pwd FROM USER WHERE user_id = ?";
        let str_sql_update = "UPDATE USER SET user_pwd = ? WHERE user_id = ?"

        // 현재 비밀번호가 넘어온 값과 일치하는지 
        db.query(str_sql_confirm, [user_id], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {
                //console.log(results);
                // 일치할 경우 비밀번호 변경
                if(results[0].user_pwd == body.current_pwd)
                {
                    db.query(str_sql_update, [body.new_pw1, user_id], (error, results) => {
                        if(error) {
                            console.log(error);
                            res.end("error");
                        } else {                           
                            res.json({ok:true});
                        }
                    });
                }
                else
                {
                    res.end("error");
                }
            }
        });
    } else {
        res.redirect('/');
    }
};


router.get('/logout',   HandleLogout);
router.get('/signup',   GetSignupPage);
//router.get('/findid',   GetFindIdPage);
//router.get('/findpwd',  GetFindPwdPage);
router.post('/login',   HandleLogin);
router.post('/signup',  HandleSignup);
//router.post('/findid',  HandleFindId);
//router.post('/findpwd', GetAlterPwdPage);
//router.put('/alterpwd', HandleAlterPwd);

router.get('/myinfo', GetMyinfo);
router.get('/alterpassword', AlterPasswordUI);
router.put('/alterpassword', multipartMiddleware, AlterPassword);


module.exports = router