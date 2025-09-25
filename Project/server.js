// Node.JS 내외부 모듈추출
const   cookieParser = require('cookie-parser');
const   session = require('express-session');
const   bodyParser = require('body-parser');
const   express = require('express');
const   os = require('os');
const   createError = require('http-errors');
const   path = require('path');
const   app = express();
const   http = require('http').Server(app); //1
const   io = require('socket.io')(http);  //1
const   mysql       = require('mysql');


// 잡티켓 개발소스 모듈
const   loginUI = require('./routes/login_ui');
const   user = require('./routes/user');
const   note = require('./routes/note');
const   report = require('./routes/report');
const   admin = require('./routes/admin');
const   noticeboard = require('./routes/noticeboard');
const   message = require('./routes/message');

/* 
    데이터베이스 연동 소스코드 
*/
// var db = mysql.createConnection({
//     host:       'localhost',        // DB서버 IP주소
//     port:       3306,               // DB서버 Port주소
//     user:       'root',             // DB접속 아이디
//     password:   'root',             // DB암호
//     database:   'Task_Board'        //사용할 DB명
// });

// function HandleDisconnectDB() {
//     db = mysql.createConnection({       // Recreate the connection, since
//         host:       'localhost',        // DB서버 IP주소
//         port:       3306,               // DB서버 Port주소
//         user:       'root',             // DB접속 아이디
//         password:   'root',             // DB암호
//         database:   'Task_Board'        //사용할 DB명
//     });

//     // the old one cannot be reused.
//     db.connect(function(err) {              // The server is either down
//         if(err) {                                     // or restarting (takes a while sometimes).
//             console.log('error when connecting to db:', err);
//             setTimeout(HandleDisconnectDB, 2000); // We introduce a delay before attempting to reconnect,
//         }                                     // to avoid a hot loop, and to allow our node script to
//     });                                         // process asynchronous requests in the meantime.

//     // If you're also serving http, display a 503 error.
//     db.on('error', function(err) {
//         console.log('db error', err);
//         if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
//             HandleDisconnectDB();                         // lost due to either server restart, or a
//         } else {                                        // connnection idle timeout (the wait_timeout
//             throw err;                                  // server variable configures this)
//         }
//     });

// }

// HandleDisconnectDB();


// 잡티켓 PORT주소 설정
const   PORT = 8000;
/*
    포트번호를 외부 모듈로 뺍니다.
*/
module.exports.PORT = PORT;

// 실행환경 설정부분
app.set('views', path.join(__dirname, 'views'));  // views경로 설정
app.set('view engine', 'ejs');                    // view엔진 지정
//app.use(express.static(path.join(__dirname, 'public')));   // public설정
app.use(express.static(path.join(__dirname, '/')));   // 고정루트경로 설정
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({ key: 'sid',
                  secret: 'secret key',  // 세션id 암호화할때 사용
                  resave: false,         // 접속할때마다 id부여금지
                  saveUninitialized: true })); // 세션id사용전에는 발급금지

// URI와 핸들러를 매핑
app.use('/', loginUI);    // URI (/) 접속하면 login_ui로 라우팅
app.use('/user', user);   // URI('/user') 접속하면 user로 라우팅
app.use('/note', note);   // URI('/note') 접속하면 note로 라우팅
app.use('/report', report); // URI('/report') 접속하면 report로 라우팅
app.use('/admin', admin); // URI('/admin') 접속하면 admin로 라우팅
app.use('/noticeboard', noticeboard);  // URI('/noticeboard') 접속하면 noticeboard로 라우팅
app.use('/message', message);  // URI('/message') 접속하면 message로 라우팅

// 서버를 실행합니다.
http.listen(PORT, function () {
    let ip_address = getServerIp();
    // ip주소를 외부 모듈로 뺍니다.
    module.exports.ip = ip_address;
    console.log('서버실행 : ' + 'http://' + ip_address + ':' + PORT);
});


   
/*
    서버 ip 가져오는 함수
*/
function getServerIp() {
    var ifaces = os.networkInterfaces();
    var result = '';
    
    for (var key in ifaces) {
        ifaces[key].forEach(function(details, index) {
            if (details.family == 'IPv4' && details.internal === false) {
                result = details.address;
            }
        });
    }
    
    return result;
}

