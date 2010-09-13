// Copyright 2010 Greg McWhirter
// Please see the LICENSE file for licensing terms.
//

var smtp = require('./lib/smtp'),
    sys = require('sys');

module.exports = function (){
    return {
        "_config": {
            host: "localhost",
            port: 25,
            from_addr: "",
            secure: false,
            debug: false,
            user: "",
            pass: ""
        },
        
        setConfig: function (new_config){
            this._config = new_config;
        },
        
        send: function (from, to, subject, body, cc, bcc, headers, callback){
            var client = new smtp.Client();
            
            if (typeof(cc) == "function")
            {
                callback = cc;
                cc = bcc = false;
                headers = {};
            }
            else if (typeof(bcc) == "function")
            {
                callback = bcc;
                bcc = false;
                headers = {};
            }
            else if (typeof(headers) == "function")
            {
                callback = headers;
                headers = {};
            }
            
            rcpt_list = [];
            
            headers = headers || {};
            headers["Date"] = (new Date()).toString();
            headers["From"] = from + " <"+this._config.from_addr+">";
            if (to instanceof Array)
            {
                headers["To"] = to.join(", ");
                to.forEach(function (item){
                    rcpt_list.push(item);
                });
            }
            else
            {
                headers["To"] = to;
                rcpt_list.push(to);
            }
            if (cc){
                if (cc instanceof Array)
                {
                    headers["Cc"] = cc.join(", ");
                    cc.forEach(function (item){
                        rcpt_list.push(item);
                    });
                }
                else
                {
                    headers["Cc"] = cc;
                    rcpt_list.push(cc);
                }
                
            } 
            if (bcc){
                if (bcc instanceof Array)
                {
                    headers["Bcc"] = bcc.join(", ");
                    bcc.forEach(function (item){
                        rcpt_list.push(item);
                    });
                }
                else
                {
                    headers["Bcc"] = bcc;
                    rcpt_list.push(bcc);
                }
                
            } 
            headers["Subject"] = subject;
            
            var message = '';
            Object.keys(headers).forEach(function (key){
                message += key+": "+headers[key]+"\r\n";
            });
            message += "\r\n"+body;
            
            var self = this;
            
            client.connect(this._config.port, this._config.host, this._config.secure, function(){
                client.auth(self._config.user, self._config.pass, function(){
                    client.mail(self._config.from_addr, function(){
                        client.rcptList(rcpt_list, function(){
                            client.data(message, function(){
                                client.quit(function(){
                                    client.disconnect();
                                    callback(true);
                                });
                            });
                        });
                    });
                });
            });
            
            if (this._config.debug)
            {
                client.addListener("packetSent", function (data){
                    sys.debug(">>> "+data);
                });
            }
            
            client.addListener("error", function(err, context){
                context = context || "packet";
                
                if (context == "quit")
                {
                    client.disconnect(function (){callback(false);});
                }
                else if (context == "disconnect")
                {
                    callback(false);
                }
                else
                {
                    client.quit(function (){
                        client.disconnect(function (){callback(false);});
                    });
                }
            });
        }
    };
};
