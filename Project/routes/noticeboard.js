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


const MainUI = (req, res) => {

};



const AllListUI = (req, res) => {
    if(req.session.userid)
    {
        // // 3개월 전 날짜를 구한다.
        // let date = new Date();
        // let before_date = new Date();   
        // before_date.setDate(date.getDate() - 92);
        // let str_date = before_date.getFullYear() + "-" + ("0" + (before_date.getMonth() + 1)).slice(-2) + "-" + ("0" + (before_date.getDate())).slice(-2);

        //let user_id = req.session.userid;
        let page = req.params.page;

        let HtmlPageStream = '';

        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/noticeboard_alllist.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        let sql_str = "SELECT * FROM NOTICE_BOARD ORDER BY notice_num DESC Limit 5000";

        db.query(sql_str, (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {
                async.waterfall([
                    function(callback) {
                        let sql_str_notification = "UPDATE NOTICE_BOARD_NOTIFICATION SET notification_alarm = 0 WHERE notification_userid = ?";
                        // 게시글 알람 상태 갱신
                        db.query(sql_str_notification, [req.session.userid], (error) => {
                            if (error) {
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
                            page            :page,
                            Notice          :results
                        }));    
                        callback(null);          
                    },
                ],  function(error) {
                    if (error) 
                    {
                        console.log(error);
                        res.end(JSON.stringify(error));
                    }
                });  
            }
        });

    } else {
        res.redirect('/');
    }
};

const ContentUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        const  query = url.parse(req.url, true).query;
        let HtmlPageStream = '';

        //console.log(query);


        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/noticeboard_content.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});


        var results_notice;
        var results_comment;
        var results_reply;
        var lengthofcomment = 0;

        async.waterfall([
            function(callback) {
                // 게시판 글 정보 검색
                let sql_str_notice = "SELECT *, DATE_FORMAT(notice_date, '%Y-%m-%d %H:%i') FROM NOTICE_BOARD WHERE notice_num = ?";
                db.query(sql_str_notice, [parseInt(query.notice_num)], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {
                        if(results.length > 0)
                        {
                            results_notice = results[0];
                            //console.log(results_notice);
                            callback(null);
                        }
                        else
                        {
                            callback("요청하신 페이지를 찾을 수 없습니다.");    
                        }
                    }
                });
            },
            function(callback) {
                // 게시판에 달린 댓글 정보 검색
                let sql_str_comment = "SELECT *, DATE_FORMAT(comment_date, '%m-%d %H:%i') FROM NOTICE_BOARD_COMMENT WHERE notice_num = ?";
                db.query(sql_str_comment, [parseInt(query.notice_num)], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {
                        results_comment = results;
                        lengthofcomment = results.length;
                        //console.log(results_comment);
                        callback(null);
                    }
                });
            },
            function(callback){
                // 댓글이 1개이상 있을 경우에만 실시
                if(lengthofcomment > 0)
                {
                    // 게시판에 달린 답글 정보 검색
                    var arrQueryParam = new Array();
                    let sql_str_reply = "";
                    sql_str_reply += "SELECT *, DATE_FORMAT(reply_date, '%m-%d %H:%i') FROM NOTICE_BOARD_REPLY WHERE ";
                    for(var i = 0; i < results_comment.length; i++)
                    {
                        arrQueryParam[i] = results_comment[i].comment_num;
                        sql_str_reply += "comment_num = ?";
                        if(i != results_comment.length - 1)
                            sql_str_reply += " OR ";
                    }

                    db.query(sql_str_reply, arrQueryParam, (error, results) => {
                        if(error) {
                            console.log(error);
                            callback(error);
                        } else {
                            results_reply = results;
                            //console.log(results_reply);
                            callback(null);
                        }
                    });
                }
                else
                {
                    callback(null);
                }
            },
            function(callback){
                // 게시글 조회수 1 증가
                let sql_str_views = "UPDATE NOTICE_BOARD SET notice_reviewcount = notice_reviewcount + 1 WHERE notice_num = ?"

                db.query(sql_str_views, [parseInt(query.notice_num)], (error, results) => {
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
                    Content         :results_notice,
                    Comment         :results_comment,
                    Reply           :results_reply,
                    userid          :user_id
                }));
                callback(null);
            }
        ],  function(error) {
            if (error) 
            {
                console.log(error);
                res.end(JSON.stringify(error));
            }
        });

    } else {
        res.redirect('/');
    }
};




const AddNoticeUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let HtmlPageStream = '';

        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/noticeboard_add_form.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        res.end(ejs.render(HtmlPageStream , {
            'title'         :'Task Board',
            level           :req.session.level,
            userid          :req.session.userid,
            src_url         :'../../'
        }));
    } else {
        res.redirect('/');
    }
};

const AddNotice = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;
        let files = req.files;

        //console.log(body);
        //console.log(files);

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

        // console.log(oldpath);
        // console.log(newpath);

        //console.log(dom.window.document.documentElement.innerHTML);
        var newcontent = dom.window.document.documentElement.innerHTML;

        let sql_str = "";
        sql_str += "INSERT INTO ";
        sql_str += "NOTICE_BOARD(notice_userid, notice_username, notice_userlevel, notice_type, notice_title, notice_date, notice_reviewcount, notice_commentcount, notice_content, ";
        sql_str += "notice_filepath1, notice_filepath2, notice_filepath3, notice_filepath4, notice_filepath5, ";
        sql_str += "notice_orgfilename1, notice_orgfilename2, notice_orgfilename3, notice_orgfilename4, notice_orgfilename5) ";
        sql_str += "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";

        db.query(sql_str, 
            [
                user_id,
                user_name,
                user_level,
                body.type,
                body.title,
                new Date(),
                0,
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
                async.waterfall([
                    function(callback) {
                        
                        // 글의 종류가 공지사항일 경우에만 알람 상태 갱신
                        if(body.type == "공지사항")
                        {
                            let sql_str_notification = "UPDATE NOTICE_BOARD_NOTIFICATION SET notification_alarm = 1 WHERE notification_userid != ?";
                            // 게시글 알람 상태 갱신
                            db.query(sql_str_notification, [req.session.userid], (error) => {
                                if (error) {
                                    console.log(error);
                                    callback(error);
                                } else {
                                    callback(null);
                                }
                            }); 
                        }
                        else
                        {
                            callback(null);
                        }
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
                        //res.redirect('/noticeboard');       
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
                        res.end(JSON.stringify(error));
                    }
                });
            }
        });

    } else {
        res.redirect('/');
    }
};


const ReviseNoticeUI = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        const  query = url.parse(req.url, true).query;

        let HtmlPageStream = '';

        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/noticeboard_revise_form.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        
        //console.log(query);

        let sql_str = "SELECT * FROM NOTICE_BOARD WHERE notice_num = ?";

        db.query(sql_str, [query.notice_num], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {        
                //console.log(results[0]);
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../../',
                    Content         :results[0]
                }));
            }
        });

    } else {
        res.redirect('/');
    }
};


const ReviseNotice = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;
        let files = req.files;

        //console.log(body);
        //console.log(files);
     

        // 첨부파일 관련 작업
        var arrFilepath = new Array(5);
        var arrFilename = new Array(5);
        var Arrindex = 0;

        // 사용자가 보낸 파일명 리스트가 있는 경우
        if(body.filelist)
        {
            // 기존에 파일이 있었던 경우
            if(body.orgfilelist)
            {
                var orgCheckArr = Array.from({length : body.orgfilelist.length}, () => 0);
                // 사용자가 보낸 파일명 리스트와 기존 파일명 리스트를 비교하여 체크배열에 체크한다.
                // 기존 파일명 리스트가 사용자가 보낸 파일명 리스트에 포함되어 있으면 배열에 추가한다.
                for(var i = 1; i < body.filelist.length; i++)
                {
                    for(var j = 0; j < body.orgfilelist.length; j++)
                    {
                        if(body.filelist[i] == body.orgfilelist[j])
                        {
                            arrFilepath[Arrindex] = body.orgfilepathlist[j];
                            arrFilename[Arrindex] = body.orgfilelist[j];
                            orgCheckArr[j]++;
                            Arrindex++;
                        }
                    }
                }

                // 기존 파일명 리스트에서 사용자가 보낸 파일명 리스트에 없는 파일들은 전부 삭제한다.
                for(var i = 0 ; i < body.orgfilepathlist.length; i++)
                {
                    if(orgCheckArr[i] == 0)
                    {                   
                        fs.unlink(body.orgfilepathlist[i], (error) => {
                            if(error) console.log(error);
                        });                        
                    }
                }
            }
    
            if(files)
            {
                // 사용자가 넘긴 파일 데이터 삽입
                for(var i = 0; i < files.length; i++)
                {
                   arrFilepath[Arrindex] = files[i].path;
                   arrFilename[Arrindex] = files[i].originalname;
                   Arrindex++;
                }
            }
    
        }
        // 사용자가 보낸 파일명 리스트가 없는 경우
        else
        {
            // 기존에 파일이 업로드 되어 있었다면 모두 지운다.
            if(body.orgfilepathlist)
            {
                for(var i = 0; i < body.orgfilepathlist.length; i++)
                {                 
                    fs.unlink(body.orgfilepathlist[i], (error) => {
                        if(error) console.log(error);
                    });              
                }
            }
        }
    
        //console.log(arrFilepath);
        //console.log(arrFilename);

        // // html 소스 작업 관련
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
                if(arrImgurl_Text[3] == "temp")
                {
                    tempFolderDir = arrImgurl_Text[2] + "/" + arrImgurl_Text[3] + "/" + arrImgurl_Text[4] + "/";
                    fileName = arrImgurl_Text[5];

                    oldpath[i] = tempFolderDir + fileName;
                    newpath[i] = ckeditor_upload + fileName;

                }
                else if (arrImgurl_Text[3] == "ckeditor_upload")
                {
                    tempFolderDir = arrImgurl_Text[2] + "/" + arrImgurl_Text[3] + "/";
                    fileName = arrImgurl_Text[4];

                    oldpath[i] = tempFolderDir + fileName;
                    newpath[i] = ckeditor_upload + fileName;
                }
                arrImgurl[i].src = "../../" + newpath[i];
            }
        }   

        //console.log(dom.window.document.documentElement.innerHTML);
        var newcontent = dom.window.document.documentElement.innerHTML;

        // DB 작업 관련
        let sql_str = "";
        sql_str += "UPDATE NOTICE_BOARD SET ";
        sql_str += "notice_type = ?, notice_title = ?, notice_content = ?, ";
        sql_str += "notice_filepath1 = ?, notice_filepath2 = ?, notice_filepath3 = ?, notice_filepath4 = ?, notice_filepath5 = ?, ";
        sql_str += "notice_orgfilename1 = ?, notice_orgfilename2 = ?, notice_orgfilename3 = ?, notice_orgfilename4 = ?, notice_orgfilename5 = ? ";
        sql_str += "WHERE notice_num = ?";

        db.query(sql_str, 
            [
                body.type,
                body.title,
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
                arrFilename[4],
                body.notice_num
            ], 
            (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {              
                async.waterfall([
                    function(callback) {
                        // ckeditor 파일관리 작업 관련
                        // 임시폴더에 있는 이미지들 중 업로드에 확정된 이미지를 영구 업로드 폴더로 이동한다.
                        if(arrImgurl)
                        {         
                            for(var i = 0; i < arrImgurl.length; i++)
                            {
                                //console.log(oldpath[i]);
                                //console.log(newpath[i]);
                                fs.renameSync(oldpath[i], newpath[i]);
                            }
                        }

                        // orgcontent 로부터 querySelectorAll로 이미지 태그 추출
                        var dom2 = new JSDOM(body.orgcontent);
                        var arrImgurl2 = dom2.window.document.querySelectorAll("img");
                        var arrImgurl2_Text = new Array();
                        var fileName2;

                        if(arrImgurl2)
                        {
                            var arrCheck_orgcontent = Array.from({length : arrImgurl2.length}, () => 0);
                            // 기존에 있던 이미지 리스트를 새로 업로드한 이미지 리스트와 비교한 후
                            for(var i = 0; i < arrImgurl.length; i++)
                            {
                                for(var j = 0; j < arrImgurl2.length; j++)
                                {
                                    if(arrImgurl[i].src == arrImgurl2[j].src)
                                    {
                                        arrCheck_orgcontent[j]++;
                                    }
                                }
                            }

                            // 필요 없어진 이미지들은 모두 지운다.
                            for(var i = 0; i < arrImgurl2.length; i++)
                            {
                                arrImgurl2_Text = arrImgurl2[i].src.split("/");
                                fileName2 = arrImgurl2_Text[4];
                                if(arrCheck_orgcontent[i] == 0)
                                {
                                    fs.unlink(ckeditor_upload + fileName2, (error) =>{
                                        if(error) console.log(error);
                                    });
                                }
                            }
                        }
                        callback(null);
                        //res.redirect('/noticeboard');       
                       
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
                        res.end(JSON.stringify(error));
                    }
                });
            }
        });

    } else {
        res.redirect('/');
    }
};


const DeleteNotice = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;

        //console.log(body);

        async.waterfall([
            function(callback) {
                // 삭제할 게시글의 데이터를 조회한다.
                let sql_str_select = "SELECT * FROM NOTICE_BOARD WHERE notice_num = ?";
                db.query(sql_str_select, [body.notice_num], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {    
                        //console.log(results[0]);
                        if(results.length > 0)
                        {
                            // 조회에 성공 했을 시 첨부파일과 이미지 파일들을 모두 지운다.
                            // 첨부파일 삭제
                            var arrFilePath = 
                            [
                                results[0].notice_filepath1,
                                results[0].notice_filepath2,
                                results[0].notice_filepath3,
                                results[0].notice_filepath4,
                                results[0].notice_filepath5
                            ];

                            for(var i = 0; i < arrFilePath.length; i++)
                            {
                                if(arrFilePath[i])
                                {
                                    fs.unlink(arrFilePath[i], (error) =>{
                                        if(error) console.log("line609"+ error);
                                    });
                                }
                            }

                            // 이미지파일 삭제
                            // notice_content로부터 querySelector를 사용하여 사용자가 업로드를 확정지은 이미지 리스트를 추출한다.
                            var dom = new JSDOM(results[0].notice_content);
                            var arrImgurl = dom.window.document.querySelectorAll("img");
                            var arrImgurl_Text = new Array();

                            for(var i = 0; i < arrImgurl.length; i++)
                            {
                                // ex) ../../public/ckeditor_upload/62177add-bcb7-4d6d-91b3-824023a9d05d.jpg >> 문자열분리
                                arrImgurl_Text = arrImgurl[i].src.split("/");
                                fs.unlink(ckeditor_upload + arrImgurl_Text[4], (error) =>{
                                    if(error) console.log("line624" + error);
                                });
                            }
                        }
                        callback(null);
                    }
                });
            },
            function(callback) {
                // 게시글 데이터를 지운다.
                let sql_str_delete = "DELETE FROM NOTICE_BOARD WHERE notice_num = ?";
                db.query(sql_str_delete, [body.notice_num], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {    
                        res.redirect('/noticeboard/list/1'); 
                        callback(null);
                    }
                });
            }
        ],  function(error) {
            if (error) 
            {
                console.log(error);
                res.end(JSON.stringify(error));
            }
        });


    } else {
        res.redirect('/');
    }
};

const SearchNotice = (req, res) => {
    if(req.session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        const  query = url.parse(req.url, true).query;

        //console.log(query);

        if(query.simple_search_text == "")
        {
            res.redirect("/noticeboard/list/1");
            return;
        }

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/noticeboard_searchlist.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        
        switch (query.condition)
        {
            case "제목" :
            {
                let sql_str = "";
                sql_str += "SELECT ";
                sql_str += "*, DATE_FORMAT(notice_date,'%Y-%m-%d') ";
                sql_str += "FROM NOTICE_BOARD ";              
                sql_str += "WHERE ";
                sql_str += "notice_title LIKE '%" + query.simple_search_text + "%' ";              
                sql_str += "ORDER BY notice_num DESC";
        
                db.query(sql_str, (error, results) => {
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
                            Notice          :results
                        }));
                    }
                });        
            }
            break;

            case "글쓴이" :
            {
                let sql_str = "";
                sql_str += "SELECT ";
                sql_str += "*, DATE_FORMAT(notice_date,'%Y-%m-%d') ";
                sql_str += "FROM NOTICE_BOARD ";           
                sql_str +="WHERE ";
                sql_str += "notice_username = ? ";                
                sql_str += "ORDER BY notice_num DESC";
        
                db.query(sql_str, [query.simple_search_text], (error, results) => {
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
                            Notice          :results
                        }));
                    }
                });        
            }
            break;

            case "내용" :
            {
                let sql_str = "";
                sql_str += "SELECT ";
                sql_str += "*, DATE_FORMAT(notice_date,'%Y-%m-%d') ";
                sql_str += "FROM NOTICE_BOARD ";              
                sql_str += "WHERE ";
                sql_str += "notice_content LIKE '%" + query.simple_search_text + "%' ";          
                sql_str += "ORDER BY notice_num DESC";
        
                db.query(sql_str, (error, results) => {
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
                            Notice          :results
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
    댓글 관련 모듈
*/
const AddComment = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;

        //console.log(body);


        async.waterfall([
            // 댓글 추가
            function(callback) {
                let sql_str = "";
                sql_str += "INSERT INTO ";
                sql_str += "NOTICE_BOARD_COMMENT(notice_num, comment_userid, comment_username, comment_userlevel, comment_date, comment_text) ";
                sql_str += "VALUES(?, ?, ?, ?, ?, ?);";

                db.query(sql_str, 
                    [
                        body.notice_num,
                        user_id,
                        user_name,
                        user_level,
                        new Date(),
                        body.comment
                    ], 
                    (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {                
                        callback(null);
                    }
                });
        
            },
            // 게시글의 댓글 개수정보 수정
            function(callback) {
                let sql_str = "";
                sql_str += "UPDATE NOTICE_BOARD SET notice_commentcount = notice_commentcount + 1 WHERE notice_num = ?";

                db.query(sql_str, 
                    [
                        body.notice_num
                    ], 
                    (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {                
                        callback(null);
                    }
                });
            },
            function(callback) {
                res.json({ok:true});  
                callback(null);           
            }
        ],  function(error, result) {
            if (error) 
            {
                console.log(error);
                res.end("error");
            }
        });

    }
    else{
        res.redirect('/');
    }
};

const ReviseComment = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;

        //console.log(body);

        let sql_str = "";
        sql_str += "UPDATE NOTICE_BOARD_COMMENT SET comment_text = ? WHERE comment_num = ?";


        db.query(sql_str, 
            [
                body.comment,
                body.comment_num
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

const DeleteComment = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;

        //console.log(body);

        let sql_str_select = "SELECT * FROM NOTICE_BOARD_REPLY WHERE comment_num = ?";


        // 처음 해당 댓글에 달려있는 모든 답글 조회
        db.query(sql_str_select, 
            [
                body.comment_num
            ], 
            (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {   
                async.waterfall([
                    // 댓글 삭제
                    function(callback) {
                        let sql_str = "";
                        sql_str += "DELETE FROM NOTICE_BOARD_COMMENT WHERE comment_num = ?";
                
                        db.query(sql_str, 
                            [
                                body.comment_num
                            ], 
                            (error) => {
                            if(error) {
                                console.log(error);
                                callback(error);
                            } else {                
                                callback(null);
                            }
                        });
                    },
                    // 게시글의 댓글 개수정보 수정
                    function(callback) {
                        let sql_str = "";
                        sql_str += "UPDATE NOTICE_BOARD SET notice_commentcount = notice_commentcount - ? WHERE notice_num = ?";
        
                        db.query(sql_str, 
                            [
                                results.length + 1,
                                body.notice_num
                            ], 
                            (error) => {
                            if(error) {
                                console.log(error);
                                callback(error);
                            } else {                
                                callback(null);
                            }
                        });
                    },
                    function(callback) {
                        res.json({ok:true});  
                        callback(null);           
                    }
                ],  function(error, result) {
                    if (error) 
                    {
                        console.log(error);
                        res.end("error");
                    }
                });                         
            }
        });


    }
    else{
        res.redirect('/');
    }
};


/* 
    답글 관련 모듈
*/
const AddReply = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;

        //console.log(body);

        async.waterfall([
            // 답글 추가
            function(callback) {
                let sql_str = "";
                sql_str += "INSERT INTO ";
                sql_str += "NOTICE_BOARD_REPLY(comment_num, reply_userid, reply_username, reply_userlevel, reply_date, reply_text) ";
                sql_str += "VALUES(?, ?, ?, ?, ?, ?);";
        
                db.query(sql_str, 
                    [
                        body.comment_num,
                        user_id,
                        user_name,
                        user_level,
                        new Date(),
                        body.reply
                    ], 
                    (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {                
                        callback(null);
                    }
                });        
            },
            // 게시글의 댓글 개수정보 수정
            function(callback) {
                let sql_str = "";
                sql_str += "UPDATE NOTICE_BOARD SET notice_commentcount = notice_commentcount + 1 WHERE notice_num = ?";

                db.query(sql_str, 
                    [
                        body.notice_num
                    ], 
                    (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {                
                        callback(null);
                    }
                });
            },
            function(callback) {
                res.json({ok:true});  
                callback(null);           
            }
        ],  function(error, result) {
            if (error) 
            {
                console.log(error);
                res.end("error");
            }
        });


    }
    else{
        res.redirect('/');
    }
};

const ReviseReply = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;

        //console.log(body);

        let sql_str = "";
        sql_str += "UPDATE NOTICE_BOARD_REPLY SET reply_text = ? WHERE reply_num = ?";


        db.query(sql_str, 
            [
                body.reply,
                body.reply_num
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

const DeleteReply = (req, res) => {
    if(req. session.userid)
    {
        let user_id = req.session.userid;
        let user_name = req.session.who;
        let user_level = req.session.level;
        let body = req.body;

        //console.log(body);


        async.waterfall([
            // 답글 삭제
            function(callback) {          
                let sql_str = "";
                sql_str += "DELETE FROM NOTICE_BOARD_REPLY WHERE reply_num = ?";

                db.query(sql_str, 
                    [
                        body.reply_num
                    ], 
                    (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {                
                        callback(null);
                    }
                });
            },
            // 게시글의 댓글 개수정보 수정
            function(callback) {
                let sql_str = "";
                sql_str += "UPDATE NOTICE_BOARD SET notice_commentcount = notice_commentcount - 1 WHERE notice_num = ?";

                db.query(sql_str, 
                    [
                        body.notice_num
                    ], 
                    (error) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {                
                        callback(null);
                    }
                });
            },
            function(callback) {
                res.json({ok:true});  
                callback(null);           
            }
        ],  function(error, result) {
            if (error) 
            {
                console.log(error);
                res.end("error");
            }
        });                         
    }
    else{
        res.redirect('/');
    }
};



// 게시글 알람 상태 얻음
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
        sql_str += "SELECT * FROM NOTICE_BOARD_NOTIFICATION WHERE notification_userid = ?";


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
                    if(results[0].notification_alarm == 1)  res.json({ok:true});
                    else    res.end("error");
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


// router를 메서드에 따라서 호출
router.get('/', MainUI);
router.get('/list/:page',  AllListUI);
router.get('/content', ContentUI);
router.get('/add', AddNoticeUI);
router.get('/revise', ReviseNoticeUI);

router.post('/add', uploadfile.array('files'), AddNotice);
router.put('/revise', uploadfile.array('files'), ReviseNotice);
router.delete('/delete', DeleteNotice);
router.get('/search', SearchNotice);

router.post('/ckeditor_upload', multipartMiddleware, CKEditor_Upload);
router.get('/content/download', FileDownload);


router.post('/comment/add', multipartMiddleware, AddComment);
router.put('/comment/revise', multipartMiddleware, ReviseComment);
router.delete('/comment/delete', multipartMiddleware, DeleteComment);

router.post('/reply/add', multipartMiddleware, AddReply);
router.put('/reply/revise', multipartMiddleware, ReviseReply);
router.delete('/reply/delete', multipartMiddleware, DeleteReply);


router.get('/notification', multipartMiddleware, GetAlarmStatus);


// 외부모듈로 추출
module.exports = router
