var app=new Vue({
    el: '#app',
    delimiters:["<{","}>"],
    data: {
        chatTitleType:"info",
        fullscreenLoading:true,
        leftTabActive:"first",
        rightTabActive:"visitorInfo",
        users:[],
        usersMap:[],
        server:getWsBaseUrl()+"/ws_kefu?token="+localStorage.getItem("token"),
        //server:getWsBaseUrl()+"/chat_server",
        socket:null,
        messageContent:"",
        currentGuest:"",
        msgList:[],
        chatTitle:"暂时未处理咨询",
        kfConfig:{
            id : "kf_1",
            name : "客服丽丽",
            avator : "",
            to_id : "",
        },
        visitor:{
            visitor_id:"",
            refer:"",
            client_ip:"",
            city:"",
            status:"",
            source_ip:"",
            created_at:"",
        },
        visitors:[],
        visitorCount:0,
        visitorCurrentPage:1,
        visitorPageSize:10,
        face:[],
        transKefuDialog:false,
        otherKefus:[],
    },
    methods: {
        //跳转
        openUrl(url) {
            window.location.href = url;
        },
        sendKefuOnline(){
            let mes = {}
            mes.type = "kfOnline";
            mes.data = this.kfConfig;
            this.socket.send(JSON.stringify(mes));
        },
        //心跳
        ping(){
            let _this=this;
            let mes = {}
            mes.type = "ping";
            mes.data = "";
            setInterval(function () {
                if(_this.socket!=null){
                    _this.socket.send(JSON.stringify(mes));
                }
            },5000)
        },
        //初始化websocket
        initConn() {
            let socket = new ReconnectingWebSocket(this.server);//创建Socket实例
            this.socket = socket
            this.socket.onmessage = this.OnMessage;
            this.socket.onopen = this.OnOpen;
        },
        OnOpen() {
            this.sendKefuOnline();
        },
        OnMessage(e) {
            const redata = JSON.parse(e.data);
            switch (redata.type){
                case "allUsers":
                    this.handleOnlineUsers(redata.data);
                    //this.sendKefuOnline();
                    break;
                case "userOnline":
                    this.addOnlineUser(redata.data);
                    //发送通知
                    let _this=this;
                    notify(redata.data.username, {
                        body: "来了",
                        icon: redata.data.avator
                    }, function(notification) {
                        //可直接打开通知notification相关联的tab窗口
                        window.focus();
                        $('#tab-first').trigger('click');
                        notification.close();
                        _this.talkTo(redata.data.uid,redata.data.username);
                    });
                    _this.alertSound();

                    break;
                case "userOffline":
                    this.removeOfflineUser(redata.data);
                    //this.sendKefuOnline();
                    break;
                case "notice":
                    // if(!this.usersMap[redata.data.uid]){
                    //     this.$notify({
                    //         title: "通知",
                    //         message: "新客户访问",
                    //         type: 'success',
                    //         duration: 0,
                    //     });
                    // }
                    this.sendKefuOnline();
                    break;
            }
            // if (redata.type == "notice") {
            //     this.$notify({
            //         title: "通知",
            //         message: "新客户访问",
            //         type: 'success',
            //         duration: 0,
            //     });
            //发送给客户我在线
            // let mes = {}
            // mes.type = "kfConnect";
            // kfConfig.guest_id=redata.data[0].uid;
            // mes.data = kfConfig;
            // this.socket.send(JSON.stringify(mes));
            //}

            if (redata.type == "message") {
                let msg = redata.data
                let content = {}
                let _this=this;
                content.avator = msg.avator;
                content.name = msg.name;
                content.content = replaceContent(msg.content);
                content.is_kefu = msg.is_kefu=="yes"? true:false;
                content.time = msg.time;
                if (msg.id == this.currentGuest) {
                    this.msgList.push(content);
                }

                for(let i=0;i<this.users.length;i++){
                    if(this.users[i].uid==msg.id){
                        this.$set(this.users[i],'last_message',msg.content);
                    }
                }
                this.scrollBottom();
                if(content.is_kefu){
                    return;
                }
                //发送通知
                notify(msg.name, {
                    body: msg.content,
                    icon: msg.avator
                }, function(notification) {
                    //可直接打开通知notification相关联的tab窗口
                    window.focus();
                    notification.close();
                    _this.talkTo(msg.id,msg.name);
                });
                _this.alertSound();
            }
        },
        //接手客户
        talkTo(guestId,name) {
            this.currentGuest = guestId;
            //this.chatTitle=name+"|"+guestId+",正在处理中...";

            //发送给客户
            let mes = {}
            mes.type = "kfConnect";
            this.kfConfig.to_id=guestId;
            mes.data = this.kfConfig;
            this.socket.send(JSON.stringify(mes));

            //获取当前访客信息
            this.getVistorInfo(guestId);
            //获取当前客户消息
            this.getMesssagesByVisitorId(guestId);
        },
        //发送给客户
        chatToUser() {
            this.messageContent=this.messageContent.trim("\r\n");
            if(this.messageContent==""||this.messageContent=="\r\n"||this.currentGuest==""){
                return;
            }
            let _this=this;
            let mes = {};
            mes.type = "kefu";
            mes.content = this.messageContent;
            mes.from_id = this.kfConfig.id;
            mes.to_id = this.currentGuest;
            mes.content = this.messageContent;
            $.post("/2/message",mes,function(res){
               if(res.code!=200){
                    _this.$message({
                        message: data.msg,
                        type: 'error'
                    });
                }
                _this.messageContent = "";
               _this.sendSound();
            });

            // let content = {}
            // content.avator = this.kfConfig.avator;
            // content.name = this.kfConfig.name;
            // content.content = replaceContent(this.messageContent);
            // content.is_kefu = true;
            // content.time = '';
            // this.msgList.push(content);
            this.scrollBottom();
        },
        //处理当前在线用户列表
        addOnlineUser:function (retData) {
            var flag=false;
            retData.last_message=retData.last_message;
            retData.status=1;
            retData.name=retData.username;
            for(let i=0;i<this.users.length;i++){
                if(this.users[i].uid==retData.uid){
                    flag=true;
                }
            }
            if(!flag){
                this.users.unshift(retData);
            }
            for(let i=0;i<this.visitors.length;i++){
                if(this.visitors[i].visitor_id==retData.uid){
                    this.visitors[i].status=1;
                    break;
                }
            }

        },
        //处理当前在线用户列表
        removeOfflineUser:function (retData) {
            for(let i=0;i<this.users.length;i++){
                if(this.users[i].uid==retData.uid){
                    this.users.splice(i,1);
                }
            }
            let vid=retData.uid;
            for(let i=0;i<this.visitors.length;i++){
                if(this.visitors[i].visitor_id==vid){
                    this.visitors[i].status=0;
                    break;
                }
            }
        },
        //处理当前在线用户列表
        handleOnlineUsers:function (retData) {
            if (this.currentGuest == "") {
                this.chatTitle = "连接成功,等待处理中...";
            }
            this.usersMap=[];
            for(let i=0;i<retData.length;i++){
                this.usersMap[retData[i].uid]=retData[i].username;
                retData[i].last_message="新访客";
            }
            if(this.users.length==0){
                this.users = retData;
            }
            for(let i=0;i<this.visitors.length;i++){
                let vid=this.visitors[i].visitor_id;
                if(typeof this.usersMap[vid]=="undefined"){
                    this.visitors[i].status=0;
                }else{
                    this.visitors[i].status=1;
                }
            }

        },
        //获取客服信息
        getKefuInfo(){
            let _this=this;
            $.ajax({
                type:"get",
                url:"/kefuinfo",
                headers:{
                    "token":localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.code==200 && data.result!=null){
                        _this.kfConfig.id=data.result.id;
                        _this.kfConfig.name=data.result.name;
                        _this.kfConfig.avator=data.result.avator;
                        _this.initConn();
                    }
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }
                }
            });
        },
        //获取客服信息
        getOnlineVisitors(){
            let _this=this;
            $.ajax({
                type:"get",
                url:"/visitors_kefu_online",
                headers:{
                    "token":localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.code==200 && data.result!=null){
                        _this.users=data.result;
                    }
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }
                }
            });
        },
        //获取信息列表
        getMesssagesByVisitorId(visitorId){
            let _this=this;
            $.ajax({
                type:"get",
                url:"/messages?visitorId="+visitorId,
                headers:{
                    "token":localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.code==200 && data.result!=null){
                        let msgList=data.result;
                        _this.msgList=[];
                        for(let i=0;i<msgList.length;i++){
                            let visitorMes=msgList[i];
                            let content = {}
                            if(visitorMes["mes_type"]=="kefu"){
                                content.is_kefu = true;
                                content.avator = visitorMes["kefu_avator"];
                                content.name = visitorMes["kefu_name"];
                            }else{
                                content.is_kefu = false;
                                content.avator = visitorMes["visitor_avator"];
                                content.name = visitorMes["visitor_name"];
                            }
                            content.content = replaceContent(visitorMes["content"]);
                            content.time = visitorMes["time"];
                            _this.msgList.push(content);
                            _this.scrollBottom();
                        }
                    }
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }
                }
            });
        },
        //获取客服信息
        getVistorInfo(vid){
            let _this=this;
            $.ajax({
                type:"get",
                url:"/visitor",
                data:{visitorId:vid},
                headers:{
                    "token":localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.result!=null){
                        let r=data.result;
                        _this.visitor=r;
                        // _this.visitor.created_at=r.created_at;
                        // _this.visitor.refer=r.refer;
                        // _this.visitor.city=r.city;
                        // _this.visitor.client_ip=r.client_ip;
                        // _this.visitor.source_ip=r.source_ip;
                        _this.visitor.status=r.status==1?"在线":"离线";
                        //_this.visitor.visitor_id=r.visitor_id;
                        _this.chatTitle="#"+r.id+"|"+r.name;
                        _this.chatTitleType="success";
                    }
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }
                }
            });
        },
        //关闭访客
        closeVisitor(visitorId){
            let _this=this;
            $.ajax({
                type:"get",
                url:"/2/message_close",
                data:{visitor_id:visitorId},
                headers:{
                    "token":localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }
                }
            });
        },
        //处理tab切换
        handleTabClick(tab, event){
            let _this=this;
            if(tab.name=="second"){
                this.getVisitorPage(1);
            }
            if(tab.name=="blackList"){
            }
        },
        //所有访客分页展示
        visitorPage(page){
            this.getVisitorPage(page);
        },
        //获取访客分页
        getVisitorPage(page){
            let _this=this;
            $.ajax({
                type:"get",
                url:"/visitors",
                data:{page:page},
                headers:{
                    "token":localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.result.list!=null){
                        _this.visitors=data.result.list;
                        _this.visitorCount=data.result.count;
                        _this.visitorPageSize=data.result.pagesize;
                    }
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }
                }
            });
        },
        //滚到底部
        scrollBottom(){
            this.$nextTick(() => {
                $('.chatBox').scrollTop($(".chatBox")[0].scrollHeight);
            });
        },
        //jquery
        initJquery(){
            this.$nextTick(() => {
                var _this=this;
                $(function () {
                    //展示表情
                    var faces=placeFace();
                    $.each(faceTitles, function (index, item) {
                        _this.face.push({"name":item,"path":faces[item]});
                    });
                    $(".faceBtn").click(function(){
                        var status=$('.faceBox').css("display");
                        if(status=="block"){
                            $('.faceBox').hide();
                        }else{
                            $('.faceBox').show();
                        }
                    });
                });
            });
        },
        //表情点击事件
        faceIconClick(index){
            $('.faceBox').hide();
            this.messageContent+="face"+this.face[index].name;
        },
        //上传图片
        uploadImg (url){
            let _this=this;
            $('#uploadImg').after('<input type="file" accept="image/gif,image/jpeg,image/jpg,image/png" id="uploadImgFile" name="file" style="display:none" >');
            $("#uploadImgFile").click();
            $("#uploadImgFile").change(function (e) {
                var formData = new FormData();
                var file = $("#uploadImgFile")[0].files[0];
                formData.append("imgfile",file); //传给后台的file的key值是可以自己定义的
                filter(file) && $.ajax({
                    url: url || '',
                    type: "post",
                    data: formData,
                    contentType: false,
                    processData: false,
                    dataType: 'JSON',
                    mimeType: "multipart/form-data",
                    success: function (res) {
                        if(res.code!=200){
                            _this.$message({
                                message: res.msg,
                                type: 'error'
                            });
                        }else{
                            _this.messageContent+='img[/' + res.result.path + ']';
                            _this.chatToUser();
                        }
                    },
                    error: function (data) {
                        console.log(data);
                    }
                });
            });
        },
        addIpblack(ip){
            let _this=this;
            $.ajax({
                type:"post",
                url:"/ipblack",
                data:{ip:ip},
                headers:{
                    "token":localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }else{
                        _this.$message({
                            message: data.msg,
                            type: 'success'
                        });
                    }
                }
            });
        },
        //粘贴上传图片
        onPasteUpload(event){
            let items = event.clipboardData && event.clipboardData.items;
            let file = null
            if (items && items.length) {
                // 检索剪切板items
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        file = items[i].getAsFile()
                    }
                }
            }
            if (!file) {
                return;
            }
            let _this=this;
            var formData = new FormData();
            formData.append('imgfile', file);
            $.ajax({
                url: '/uploadimg',
                type: "post",
                data: formData,
                contentType: false,
                processData: false,
                dataType: 'JSON',
                mimeType: "multipart/form-data",
                success: function (res) {
                    if(res.code!=200){
                        _this.$message({
                            message: res.msg,
                            type: 'error'
                        });
                    }else{
                        _this.messageContent+='img[/' + res.result.path + ']';
                        _this.chatToUser();
                    }
                },
                error: function (data) {
                    console.log(data);
                }
            });
        },
        openUrl(url){
            window.open(url);
        },
        //提示音
        alertSound(){
            var b = document.getElementById("chatMessageAudio");
            var p = b.play();
            p && p.then(function(){}).catch(function(e){});
        },
        sendSound(){
            var b = document.getElementById("chatMessageSendAudio");
            var p = b.play();
            p && p.then(function(){}).catch(function(e){});
        },
        //转移客服
        transKefu(){
            this.transKefuDialog=true;
            var _this=this;
            this.sendAjax("/other_kefulist","get",{},function(result){
                _this.otherKefus=result;
            });
        },
        //转移访客客服
        transKefuVisitor(kefu,visitorId){
            var _this=this;
            this.sendAjax("/trans_kefu","get",{kefu_id:kefu,visitor_id:visitorId},function(result){
                //_this.otherKefus=result;
                _this.transKefuDialog = false
            });
        },
        sendAjax(url,method,params,callback){
            let _this=this;
            $.ajax({
                type: method,
                url: url,
                data:params,
                headers: {
                    "token": localStorage.getItem("token")
                },
                success: function(data) {
                    if(data.code!=200){
                        _this.$message({
                            message: data.msg,
                            type: 'error'
                        });
                    }else if(data.result!=null){
                        callback(data.result);
                    }else{
                        callback(data);
                    }
                }
            });
        },
    },
    mounted() {
        document.addEventListener('paste', this.onPasteUpload)
    },
    created: function () {
        //jquery
        this.initJquery();
        this.getKefuInfo();
        this.getOnlineVisitors();
        //心跳
        this.ping();
    }
})
