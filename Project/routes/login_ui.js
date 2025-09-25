const  express  = require('express');
const  ejs      = require('ejs');
const  fs       = require('fs');
const  router   = express.Router();

/*
    메인화면을 출력합니다.
*/
const  GetLoginUI = (req, res) => {   
    let loginPageHtmlStream = ''; 
    loginPageHtmlStream = loginPageHtmlStream + fs.readFileSync(__dirname + '/../views/header_login.ejs','utf8'); 
    loginPageHtmlStream = loginPageHtmlStream + fs.readFileSync(__dirname + '/../views/login.ejs','utf8'); 
    loginPageHtmlStream = loginPageHtmlStream + fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 

    res.writeHead(200, {'Content-Type':'text/html; charset=utf8'}); // 200은 성공
    res.end(ejs.render(loginPageHtmlStream, {
                                            'title' : '로그인',
                                            src_url : '../'})); 
};

router.get('/', GetLoginUI);

module.exports = router