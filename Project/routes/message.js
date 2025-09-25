const   fs          = require('fs');
const   fsExtra     = require('fs-extra');
const   express     = require('express');
const   ejs         = require('ejs');
const   mysql       = require('mysql');
const   bodyParser  = require('body-parser');
const   methodOverride = require('method-override');
const   url = require('url');
//const   session     = require('express-session');
const   router      = express.Router();
//const   requestIp   = require('request-ip');
//const   moment      = require('moment');
const   async       = require('async');
const   multer      = require('multer');
const   path = require('path');
const   uuid = require('uuidv4');
const   multipart = require('connect-multiparty');
// const   { listenerCount } = require('process');
const   tempDir = 'public/temp/';
const   fileDir = 'public/files/';
const   ckeditor_upload = 'public/ckeditor_upload/';
//const   multipartMiddleware = multipart({ uploadDir:  ckeditor_upload });
const   multipartMiddleware = multipart({ uploadDir:  tempDir });
const   uploadfile      = multer({dest:  fileDir}); //업로드 경로 설정
// const   querySelectorAll    = require('queryselector');
const   { JSDOM } = require('jsdom');
const { REPL_MODE_SLOPPY } = require('repl');
const { stringify } = require('querystring');
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
    database:   'Task_Board',       // 사용할 DB명
    multipleStatements: true,       // 다중쿼리 옵션
});

function HandleDisconnectDB() {
    db = mysql.createConnection({
        host:       'localhost',        // DB서버 IP주소
        port:       3306,               // DB서버 Port주소
        user:       'root',             // DB접속 아이디
        password:   'root',             // DB암호
        database:   'Task_Board',       // 사용할 DB명
        multipleStatements: true,       // 다중쿼리 옵션
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

const MainUI = (req, res) => {

};

/*
    메시지 보내는 작업
*/
const SendMessageUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let HtmlPageStream = '';

        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/message_send_form.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        let sql_str = "SELECT * FROM USER WHERE user_id != 'admin' ORDER BY BINARY(user_name)";

        db.query(sql_str, (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {                
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../../',
                    User            :results
                }));
            }
        });
    } else {
        res.redirect('/');
    }
};

const SendMessage = (req, res) => {
    if(req.session.userid)
    {
        let body = req.body;
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let files = req.files;

        //console.log(body);
        //console.log(files);
        //console.log(JSON.stringify(body.receiveuserid)); // type = string

         // 첨부파일 관련 작업
         var arrFilepath = new Array(5);
         var arrFilename = new Array(5);
 
         if(files)
         {
             // 실제 사용자가 업로드를 원하지 않는 파일들 삭제
             for(var i = 0; i < files.length; i++)
             {
                arrFilepath[i] = files[i].path;
                arrFilename[i] = files[i].originalname;
             }
         }
 
         //console.log(arrFilepath);
         //console.log(arrFilename);
 
 
         // html 소스 작업 관련
         // body.content로부터 querySelector를 사용하여 사용자가 업로드를 확정지은 이미지 리스트를 추출한다.
         var dom = new JSDOM(body.content);
         var arrImgurl = dom.window.document.querySelectorAll("img");
         var arrImgurl_Text = new Array();
         var oldpath = new Array();
         var newpath = new Array();
         var tempFolderDir;
         var fileName;
 
         // DB에 데이터 삽입이 성공할 시 임시 폴더에 있는 이미지를 업로드 폴더로 옮긴다. 
         if(arrImgurl)
         {
             for(var i = 0; i < arrImgurl.length; i++)
             {
                 // ex) ../../public/temp/test/62177add-bcb7-4d6d-91b3-824023a9d05d.jpg >> 문자열분리
                 arrImgurl_Text = arrImgurl[i].src.split("/");
                 tempFolderDir = arrImgurl_Text[2] + "/" + arrImgurl_Text[3] + "/" + arrImgurl_Text[4] + "/";
                 fileName = arrImgurl_Text[5];
 
                 oldpath[i] = tempFolderDir + fileName;
                 newpath[i] = ckeditor_upload + fileName;
 
                 arrImgurl[i].src = "../../" + newpath[i];
             }
         }   
 
        //  console.log(oldpath);
        //  console.log(newpath);

        //console.log(dom.window.document.documentElement.innerHTML);
        var newcontent = dom.window.document.documentElement.innerHTML;

        let sql_str_insert = "";
        sql_str_insert += "INSERT INTO ";
        sql_str_insert += "MESSAGE(message_userid, message_username, message_title, message_date, message_check, message_content, ";
        sql_str_insert += "message_filepath1, message_filepath2, message_filepath3, message_filepath4, message_filepath5, ";
        sql_str_insert += "message_orgfilename1, message_orgfilename2, message_orgfilename3, message_orgfilename4, message_orgfilename5) ";
        sql_str_insert += "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        let sql_str_select = "";
        sql_str_select += "SELECT LAST_INSERT_ID()";

        db.query(sql_str_insert + "; " + sql_str_select, 
            [
                user_id,
                user_name,
                body.title,
                new Date(),
                0,
                newcontent,
                arrFilepath[0],
                arrFilepath[1],
                arrFilepath[2],
                arrFilepath[3],
                arrFilepath[4],
                arrFilename[0],
                arrFilename[1],
                arrFilename[2],
                arrFilename[3],
                arrFilename[4]
            ], 
            (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {      
                //console.log(results[1][0]["LAST_INSERT_ID()"]);
                async.waterfall([
                    function(callback) {
                        // 항상 id와 name 배열의 길이는 같다.
                        var arrReceiveUserid = new Array();
                        var arrReceiveUsername = new Array();
                        if(typeof(body.receiveuserid) == "string")
                        {   
                            arrReceiveUserid[0] = body.receiveuserid;
                            arrReceiveUsername[0] = body.receiveusername;
                        }
                        else
                        {
                            arrReceiveUserid = body.receiveuserid;
                            arrReceiveUsername = body.receiveusername;
                        }


                        // Receiver DB에 데이터를 넣어준다.
                        let sql_str_receiver = "";
                        sql_str_receiver += "INSERT INTO ";
                        sql_str_receiver += "MESSAGE_RECEIVER(message_num, receiver_senderid, receiver_sendername, receiver_userid, receiver_username ,receiver_check) ";
                        sql_str_receiver += "VALUES";
                        for(var i = 0; i < arrReceiveUserid.length; i++)
                        {
                            sql_str_receiver += "(" + results[1][0]["LAST_INSERT_ID()"] + ",'" + user_id + "','" + user_name + "','" + arrReceiveUserid[i] + "','" + arrReceiveUsername[i] + "', 0)";
                            if(i !=  arrReceiveUserid.length - 1) sql_str_receiver += ", ";
                        }

                        db.query(sql_str_receiver, (error) => {
                            if(error) {
                                //console.log(error);
                                callback(error);
                            } else {
                                callback(null);
                            }
                        });                      
                    },
                    function(callback) {
                        // ckeditor 파일관리 작업 관련
                        if(arrImgurl)
                        {
                            for(var i = 0; i < arrImgurl.length; i++)
                            {
                                fs.renameSync(oldpath[i], newpath[i]);
                            }
                        }
                        callback(null);    
                    },
                    function(callback) {
                        // 임시폴더 내용 삭제
                        let dir = tempDir + req.session.userid + "/";
                        fsExtra.emptyDirSync(dir);
                       
                        callback(null);      
                    },
                    function(callback) {
                        // 클라이언트에 응답                     
                        res.json({ok:true}); 
                        callback(null);   
                    },
                ],  function(error) {
                    if (error) 
                    {
                        console.log(error);
                        res.end("error");
                    }
                });
            }
        });


     
    } else {
        res.redirect('/');
    }
};


/*
    보낸 메시지
*/
const SentMessageListUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let page = req.params.page;

        let HtmlPageStream = '';

        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/message_sentlist.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        // 부속질의문 결과 테이블을 MESSAGE으로 별칭해준다.
        let subsql_str = "(SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') FROM MESSAGE WHERE message_userid = ? LIMIT 1000) MESSAGE ";
        let sql_str = "";
        sql_str += "SELECT * ";
        sql_str += "FROM "+ subsql_str + "JOIN MESSAGE_RECEIVER ";
        sql_str += "ON MESSAGE.message_userid = MESSAGE_RECEIVER.receiver_senderid ";
        sql_str += "AND MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
        sql_str += "WHERE MESSAGE.message_userid = ? ";
        sql_str += "ORDER BY MESSAGE.message_date DESC";
      
        db.query(sql_str, [user_id, user_id], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {     
                //console.log(results);           
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../../',
                    page            :page,
                    Message         :results
                }));
            }
        });
    } else {
        res.redirect('/');
    }
};

const SearchSentMessageUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        const  query = url.parse(req.url, true).query;

        //console.log(query);

        if(query.simple_search_text == "")
        {
            res.redirect("/message/sentlist/1");
            return;
        }

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/message_searchsentlist.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        
        switch (query.condition)
        {
            case "제목" :
            {
                // 부속질의문 결과 테이블을 MESSAGE으로 별칭해준다.
                let subsql_str = "(SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') FROM MESSAGE WHERE message_userid = ?) MESSAGE ";
                let sql_str = "";
                sql_str += "SELECT * ";
                sql_str += "FROM "+ subsql_str + "JOIN MESSAGE_RECEIVER ";
                sql_str += "ON MESSAGE.message_userid = MESSAGE_RECEIVER.receiver_senderid ";
                sql_str += "AND MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
                sql_str += "WHERE MESSAGE.message_userid = ? AND MESSAGE.message_title LIKE '%" + query.simple_search_text + "%' ";
                sql_str += "ORDER BY MESSAGE.message_date DESC";
        
                db.query(sql_str, [user_id, user_id], (error, results) => {
                    if(error) {
                        console.log(error);
                        res.end("error");
                    } else {
                        //console.log(results);
                        res.end(ejs.render(HtmlPageStream , {
                            'title'         :'Task Board',
                            level           :req.session.level,
                            userid          :req.session.userid,
                            src_url         :'../../',
                            Message          :results
                        }));
                    }
                });        
            }
            break;

            case "받은사람" :
            {
                // 부속질의문 결과 테이블을 MESSAGE으로 별칭해준다.
                let subsql_str = "(SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') FROM MESSAGE WHERE message_userid = ?) MESSAGE ";
                let sql_str = "";
                sql_str += "SELECT * ";
                sql_str += "FROM "+ subsql_str + "JOIN MESSAGE_RECEIVER ";
                sql_str += "ON MESSAGE.message_userid = MESSAGE_RECEIVER.receiver_senderid ";
                sql_str += "AND MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
                sql_str += "WHERE MESSAGE.message_userid = ? AND MESSAGE_RECEIVER.receiver_username = ?";
                sql_str += "ORDER BY MESSAGE.message_date DESC";

                db.query(sql_str, [user_id, user_id, query.simple_search_text], (error, results) => {
                    if(error) {
                        console.log(error);
                        res.end("error");
                    } else {
                        //console.log(results);
                        res.end(ejs.render(HtmlPageStream , {
                            'title'         :'Task Board',
                            level           :req.session.level,
                            userid          :req.session.userid,
                            src_url         :'../../',
                            Message          :results
                        }));
                    }
                });        
            }
            break;

            case "내용" :
            {
                // 부속질의문 결과 테이블을 MESSAGE으로 별칭해준다.
                let subsql_str = "(SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') FROM MESSAGE WHERE message_userid = ?) MESSAGE ";
                let sql_str = "";
                sql_str += "SELECT * ";
                sql_str += "FROM "+ subsql_str + "JOIN MESSAGE_RECEIVER ";
                sql_str += "ON MESSAGE.message_userid = MESSAGE_RECEIVER.receiver_senderid ";
                sql_str += "AND MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
                sql_str += "WHERE MESSAGE.message_userid = ? AND MESSAGE.message_content LIKE '%" + query.simple_search_text + "%' ";
                sql_str += "ORDER BY MESSAGE.message_date DESC";
        
                db.query(sql_str, [user_id, user_id], (error, results) => {
                    if(error) {
                        console.log(error);
                        res.end("error");
                    } else {
                        //console.log(results);
                        res.end(ejs.render(HtmlPageStream , {
                            'title'         :'Task Board',
                            level           :req.session.level,
                            userid          :req.session.userid,
                            src_url         :'../../',
                            Message          :results
                        }));
                    }
                });        
            }
            break;

            default: break;
        }

    } else {
        res.redirect('/');
    }
};

/*
    받은 메시지
*/
const ReceivedMessageListUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let page = req.params.page;

        let HtmlPageStream = '';

        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/message_receivedlist.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        // 부속질의문 결과 테이블을 MESSAGE_RECEIVER으로 별칭해준다.
        let subsql_str = "(SELECT * FROM MESSAGE_RECEIVER WHERE receiver_userid = ? LIMIT 1000) MESSAGE_RECEIVER ";
        let sql_str = "";
        sql_str += "SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') ";
        sql_str += "FROM "+ subsql_str + "JOIN MESSAGE ";
        sql_str += "ON MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
        sql_str += "ORDER BY MESSAGE.message_date DESC";
      
        db.query(sql_str, [user_id, user_id], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {     
                //console.log(results);           
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../../',
                    page            :page,
                    Message         :results
                }));
            }
        });
    } else {
        res.redirect('/');
    }
};

const SearchReceivedMessageUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        const  query = url.parse(req.url, true).query;

        //console.log(query);

        if(query.simple_search_text == "")
        {
            res.redirect("/message/receivedlist/1");
            return;
        }

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/message_searchreceivedlist.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        
        switch (query.condition)
        {
            case "제목" :
            {
                // 부속질의문 결과 테이블을 MESSAGE_RECEIVER으로 별칭해준다.
                let subsql_str = "(SELECT * FROM MESSAGE_RECEIVER WHERE receiver_userid = ? LIMIT 1000) MESSAGE_RECEIVER ";
                let sql_str = "";
                sql_str += "SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') ";
                sql_str += "FROM "+ subsql_str + "JOIN MESSAGE ";
                sql_str += "ON MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
                sql_str += "WHERE MESSAGE.message_title LIKE '%" + query.simple_search_text + "%' "
                sql_str += "ORDER BY MESSAGE.message_date DESC";
                db.query(sql_str, [user_id], (error, results) => {
                    if(error) {
                        console.log(error);
                        res.end("error");
                    } else {
                        //console.log(results);
                        res.end(ejs.render(HtmlPageStream , {
                            'title'         :'Task Board',
                            level           :req.session.level,
                            userid          :req.session.userid,
                            src_url         :'../../',
                            Message          :results
                        }));
                    }
                });        
            }
            break;

            case "보낸사람" :
            {
                 // 부속질의문 결과 테이블을 MESSAGE_RECEIVER으로 별칭해준다.
                 let subsql_str = "(SELECT * FROM MESSAGE_RECEIVER WHERE receiver_userid = ? LIMIT 1000) MESSAGE_RECEIVER ";
                 let sql_str = "";
                 sql_str += "SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') ";
                 sql_str += "FROM "+ subsql_str + "JOIN MESSAGE ";
                 sql_str += "ON MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
                 sql_str += "WHERE MESSAGE.message_username = ? "
                 sql_str += "ORDER BY MESSAGE.message_date DESC";

                db.query(sql_str, [user_id, query.simple_search_text], (error, results) => {
                    if(error) {
                        console.log(error);
                        res.end("error");
                    } else {
                        //console.log(results);
                        res.end(ejs.render(HtmlPageStream , {
                            'title'         :'Task Board',
                            level           :req.session.level,
                            userid          :req.session.userid,
                            src_url         :'../../',
                            Message          :results
                        }));
                    }
                });        
            }
            break;

            case "내용" :
            {
                // 부속질의문 결과 테이블을 MESSAGE_RECEIVER으로 별칭해준다.
                let subsql_str = "(SELECT * FROM MESSAGE_RECEIVER WHERE receiver_userid = ? LIMIT 1000) MESSAGE_RECEIVER ";
                let sql_str = "";
                sql_str += "SELECT *, DATE_FORMAT(message_date, '%Y.%m.%d %H:%i') ";
                sql_str += "FROM "+ subsql_str + "JOIN MESSAGE ";
                sql_str += "ON MESSAGE.message_num = MESSAGE_RECEIVER.message_num ";
                sql_str += "WHERE MESSAGE.message_content LIKE '%" + query.simple_search_text + "%' "
                sql_str += "ORDER BY MESSAGE.message_date DESC";
                
                db.query(sql_str, [user_id], (error, results) => {
                    if(error) {
                        console.log(error);
                        res.end("error");
                    } else {
                        //console.log(results);
                        res.end(ejs.render(HtmlPageStream , {
                            'title'         :'Task Board',
                            level           :req.session.level,
                            userid          :req.session.userid,
                            src_url         :'../../',
                            Message          :results
                        }));
                    }
                });        
            }
            break;

            default: break;
        }

    } else {
        res.redirect('/');
    }
};



/*
    메시지 상세 내용
*/
const ContentUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        const  query = url.parse(req.url, true).query;
        let HtmlPageStream = '';

        //console.log(query);

        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/message_content.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        let message_results;
        let message_receiver_results;

        async.waterfall([
            // MESSAGE Table에서 데이터 조회
            function(callback) {

                let sql_str = "SELECT *, DATE_FORMAT(message_date, '%Y-%m-%d %H:%i') FROM MESSAGE WHERE message_num = ?";

                db.query(sql_str, [query.message_num], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {    
                        message_results = results[0];
                        callback(null);    
                    }
                });
            },
            // MESSAGE_RECEIVER Table에서 데이터 조회
            function(callback) {
                let sql_str_receiver = "SELECT * FROM MESSAGE_RECEIVER WHERE message_num = ?"
        
                db.query(sql_str_receiver, [query.message_num], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {
                        //console.log(results);            
                        message_receiver_results = results;                    
                        callback(null);       
                
                    } 
                });   
            },
            // MSSAGE_RECEIVER Table에서 check 속성 갱신
            function(callback) {
                let sql_str_check = "UPDATE MESSAGE_RECEIVER SET receiver_check = 1 WHERE message_num = ? and receiver_userid = ?";
                db.query(sql_str_check, [query.message_num,  user_id], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {                   
                        callback(null);                
                    } 
                });      
            },
            function(callback) {        
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../../',
                    Content         :message_results,
                    Receiver        :message_receiver_results
                }));
                callback(null);   
            },
        ],  function(error) {
            if (error) 
            {
                console.log(error);
                res.end("error");
            }
        })

    } else {
        res.redirect('/');
    }
};

/*
    첨부파일 다운로드
*/
const FileDownload = (req, res) => {
    if(req. session.userid)
    {
        //console.log("다운로드다운로드~~");
        const  query = url.parse(req.url, true).query;
        var filepath = query.filepath;
        var filename = query.filename;

        //console.log(filepath);
        //console.log(filename);

        res.download(filepath, filename);
    }
    else{
        res.redirect('/');
    }
};


/*
    메시지 삭제
*/
const DeleteMessage = (req, res) =>
{

};



/*
    CKEditor 이미지 업로드
*/
const CKEditor_Upload = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let files = req.files;
        let strFolderpath = "../../";
        //console.log(body);
        //console.log(files);
        //console.log(files.upload);
        //console.log(uuid);
        var orifilepath = files.upload.path;  
        var orifilename = files.upload.name;  
        var srvfilename = uuid.uuid() + path.extname(orifilename);  

        // 임시 폴더 생성
        let dir = tempDir + req.session.userid + "/";
        !fs.existsSync(dir)&&fs.mkdirSync(dir);
         
        fs.readFile(orifilepath, function (err, data) {  
            var newPath = dir + srvfilename;
            fs.writeFile(newPath, data, function (err) {      
                if (err) console.log({ err: err });      
                else {        

                    html = "{\"filename\" : \"" + orifilename + "\", \"uploaded\" : 1, \"url\": \"" + strFolderpath + newPath + "\"}";
                    //console.log(html);      
                    res.send(html);
                    fs.unlink(files.upload.path, (error) => {
                        if(error) console.log("noticeboard_line_146 : " + error);
                    });   
                }    
            });  
        });

    } else {
        res.redirect('/');
    }
};

// 메시지 수신 상태 얻음
const GetAlarmStatus = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        const  query = url.parse(req.url, true).query;

        //console.log("get 수신받음");
        //console.log(query);

        let sql_str = "";
        sql_str += "SELECT * FROM MESSAGE_RECEIVER WHERE receiver_userid = ? and receiver_check = 0";


        db.query(sql_str, 
            [
                user_id
            ], 
            (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {   
                if(results.length > 0)
                {
                    res.json({ok:true});
                }   
                else
                {
                    res.end("error");
                }          
            }
        });


    }
    else{
        res.redirect('/');
    }
};

// 모든 메시지를 수신처리 한다.
const CheckAllReceive = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        const  query = url.parse(req.url, true).query;

        //console.log("get 수신받음");
        //console.log(query);

        let sql_str = "";
        sql_str += "UPDATE MESSAGE_RECEIVER SET receiver_check = 1 WHERE receiver_userid = ? and receiver_check = 0";


        db.query(sql_str, 
            [
                user_id
            ], 
            (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {   
                res.json({ok:true});          
            }
        });


    }
    else{
        res.redirect('/');
    }
};

// router를 메서드에 따라서 호출
router.get('/', MainUI);

router.get('/send',  SendMessageUI);
router.post('/send', uploadfile.array('files'), SendMessage);

router.get('/sentlist/:page', SentMessageListUI);
router.get('/searchsent', SearchSentMessageUI);

router.get('/receivedlist/:page', ReceivedMessageListUI);
router.get('/searchreceived', SearchReceivedMessageUI);

router.get('/content', ContentUI);
router.get('/content/download', FileDownload);
router.delete('/delete', DeleteMessage);

router.post('/ckeditor_upload', multipartMiddleware, CKEditor_Upload);


router.get('/notification', multipartMiddleware, GetAlarmStatus);
router.put('/check_allreceived', multipartMiddleware, CheckAllReceive);


// 외부모듈로 추출
module.exports = router
