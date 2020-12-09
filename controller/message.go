package controller

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/taoshihan1991/imaptool/config"
	"github.com/taoshihan1991/imaptool/models"
	"github.com/taoshihan1991/imaptool/tools"
	"github.com/taoshihan1991/imaptool/ws"
	"os"
	"path"
	"strings"
	"time"
)

// @Summary 发送消息接口
// @Produce  json
// @Accept multipart/form-data
// @Param from_id formData   string true "来源uid"
// @Param to_id formData   string true "目标uid"
// @Param content formData   string true "内容"
// @Param type formData   string true "类型|kefu,visitor"
// @Success 200 {object} controller.Response
// @Failure 200 {object} controller.Response
// @Router /message [post]
func SendMessage(c *gin.Context) {
	fromId := c.PostForm("from_id")
	toId := c.PostForm("to_id")
	content := c.PostForm("content")
	cType := c.PostForm("type")
	if content == "" {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "内容不能为空",
		})
		return
	}

	var kefuInfo models.User
	var vistorInfo models.Visitor
	if cType == "kefu" {
		kefuInfo = models.FindUser(fromId)
		vistorInfo = models.FindVisitorByVistorId(toId)
	} else if cType == "visitor" {
		vistorInfo = models.FindVisitorByVistorId(fromId)
		kefuInfo = models.FindUser(toId)
	}

	if kefuInfo.ID == 0 || vistorInfo.ID == 0 {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "用户不存在",
		})
		return
	}
	models.CreateMessage(kefuInfo.Name, vistorInfo.VisitorId, content, cType)

	if cType == "kefu" {
		guest, ok := clientList[vistorInfo.VisitorId]
		if guest == nil || !ok {
			c.JSON(200, gin.H{
				"code": 200,
				"msg":  "ok",
			})
			return
		}
		conn := guest.conn

		msg := TypeMessage{
			Type: "message",
			Data: ClientMessage{
				Name:    kefuInfo.Nickname,
				Avator:  kefuInfo.Avator,
				Id:      kefuInfo.Name,
				Time:    time.Now().Format("2006-01-02 15:04:05"),
				ToId:    vistorInfo.VisitorId,
				Content: content,
			},
		}
		str, _ := json.Marshal(msg)
		PushServerTcp(str)
		conn.WriteMessage(websocket.TextMessage, str)
	}
	if cType == "visitor" {
		kefuConns, ok := kefuList[kefuInfo.Name]
		if kefuConns == nil || !ok {
			c.JSON(200, gin.H{
				"code": 200,
				"msg":  "ok",
			})
			return
		}
		msg := TypeMessage{
			Type: "message",
			Data: ClientMessage{
				Avator:  vistorInfo.Avator,
				Id:      vistorInfo.VisitorId,
				Name:    vistorInfo.Name,
				ToId:    kefuInfo.Name,
				Content: content,
				Time:    time.Now().Format("2006-01-02 15:04:05"),
			},
		}
		str, _ := json.Marshal(msg)
		PushServerTcp(str)
		for _, kefuConn := range kefuConns {
			kefuConn.WriteMessage(websocket.TextMessage, str)
		}
	}
	c.JSON(200, gin.H{
		"code": 200,
		"msg":  "ok",
	})
}
func SendMessageV2(c *gin.Context) {
	fromId := c.PostForm("from_id")
	toId := c.PostForm("to_id")
	content := c.PostForm("content")
	cType := c.PostForm("type")
	if content == "" {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "内容不能为空",
		})
		return
	}

	var kefuInfo models.User
	var vistorInfo models.Visitor
	if cType == "kefu" {
		kefuInfo = models.FindUser(fromId)
		vistorInfo = models.FindVisitorByVistorId(toId)
	} else if cType == "visitor" {
		vistorInfo = models.FindVisitorByVistorId(fromId)
		kefuInfo = models.FindUser(toId)
	}

	if kefuInfo.ID == 0 || vistorInfo.ID == 0 {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "用户不存在",
		})
		return
	}
	models.CreateMessage(kefuInfo.Name, vistorInfo.VisitorId, content, cType)
	var msg TypeMessage
	if cType == "kefu" {
		guest, ok := ws.ClientList[vistorInfo.VisitorId]

		if guest != nil && ok {
			conn := guest.Conn

			msg = TypeMessage{
				Type: "message",
				Data: ws.ClientMessage{
					Name:    kefuInfo.Nickname,
					Avator:  kefuInfo.Avator,
					Id:      kefuInfo.Name,
					Time:    time.Now().Format("2006-01-02 15:04:05"),
					ToId:    vistorInfo.VisitorId,
					Content: content,
					IsKefu:  "no",
				},
			}
			str, _ := json.Marshal(msg)
			conn.WriteMessage(websocket.TextMessage, str)
		}

		msg = TypeMessage{
			Type: "message",
			Data: ws.ClientMessage{
				Name:    kefuInfo.Nickname,
				Avator:  kefuInfo.Avator,
				Id:      vistorInfo.VisitorId,
				Time:    time.Now().Format("2006-01-02 15:04:05"),
				ToId:    vistorInfo.VisitorId,
				Content: content,
				IsKefu:  "yes",
			},
		}
		str2, _ := json.Marshal(msg)
		ws.OneKefuMessage(kefuInfo.Name, str2)
	}
	if cType == "visitor" {
		//kefuConns, ok := ws.KefuList[kefuInfo.Name]
		//if kefuConns == nil || !ok {
		//	c.JSON(200, gin.H{
		//		"code": 200,
		//		"msg":  "ok",
		//	})
		//	return
		//}
		msg = TypeMessage{
			Type: "message",
			Data: ws.ClientMessage{
				Avator:  vistorInfo.Avator,
				Id:      vistorInfo.VisitorId,
				Name:    vistorInfo.Name,
				ToId:    kefuInfo.Name,
				Content: content,
				Time:    time.Now().Format("2006-01-02 15:04:05"),
				IsKefu:  "no",
			},
		}
		str, _ := json.Marshal(msg)
		ws.OneKefuMessage(kefuInfo.Name, str)
	}
	c.JSON(200, gin.H{
		"code":   200,
		"msg":    "ok",
		"result": msg,
	})
}
func SendVisitorNotice(c *gin.Context) {
	notice := c.Query("msg")
	if notice == "" {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "msg不能为空",
		})
		return
	}
	msg := TypeMessage{
		Type: "notice",
		Data: notice,
	}
	str, _ := json.Marshal(msg)
	for _, visitor := range clientList {
		visitor.conn.WriteMessage(websocket.TextMessage, str)
	}
	c.JSON(200, gin.H{
		"code": 200,
		"msg":  "ok",
	})
}
func SendCloseMessage(c *gin.Context) {
	visitorId := c.Query("visitor_id")
	if visitorId == "" {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "visitor_id不能为空",
		})
		return
	}
	msg := TypeMessage{
		Type: "close",
		Data: visitorId,
	}
	str, _ := json.Marshal(msg)
	for _, visitor := range clientList {
		if visitorId == visitor.id {
			visitor.conn.WriteMessage(websocket.TextMessage, str)
		}
	}
	c.JSON(200, gin.H{
		"code": 200,
		"msg":  "ok",
	})
}
func SendCloseMessageV2(c *gin.Context) {
	visitorId := c.Query("visitor_id")
	if visitorId == "" {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "visitor_id不能为空",
		})
		return
	}
	msg := TypeMessage{
		Type: "close",
		Data: visitorId,
	}
	str, _ := json.Marshal(msg)
	for _, visitor := range ws.ClientList {
		if visitorId == visitor.Id {
			if err := visitor.Conn.WriteMessage(websocket.TextMessage, str); err != nil {
				visitor.Conn.Close()
				delete(ws.ClientList, visitorId)
			}
		}
	}
	c.JSON(200, gin.H{
		"code": 200,
		"msg":  "ok",
	})
}
func UploadImg(c *gin.Context) {
	config := config.CreateConfig()
	f, err := c.FormFile("imgfile")
	if err != nil {
		c.JSON(200, gin.H{
			"code": 400,
			"msg":  "上传失败!",
		})
		return
	} else {

		fileExt := strings.ToLower(path.Ext(f.Filename))
		if fileExt != ".png" && fileExt != ".jpg" && fileExt != ".gif" && fileExt != ".jpeg" {
			c.JSON(200, gin.H{
				"code": 400,
				"msg":  "上传失败!只允许png,jpg,gif,jpeg文件",
			})
			return
		}
		fileName := tools.Md5(fmt.Sprintf("%s%s", f.Filename, time.Now().String()))
		fildDir := fmt.Sprintf("%s%d%s/", config.Upload, time.Now().Year(), time.Now().Month().String())
		isExist, _ := tools.IsFileExist(fildDir)
		if !isExist {
			os.Mkdir(fildDir, os.ModePerm)
		}
		filepath := fmt.Sprintf("%s%s%s", fildDir, fileName, fileExt)
		c.SaveUploadedFile(f, filepath)
		c.JSON(200, gin.H{
			"code": 200,
			"msg":  "上传成功!",
			"result": gin.H{
				"path": filepath,
			},
		})
	}
}

func GetMessagesV2(c *gin.Context) {
	visitorId := c.Query("visitor_id")
	messages := models.FindMessageByVisitorId(visitorId)
	//result := make([]map[string]interface{}, 0)
	chatMessages := make([]ChatMessage, 0)
	for _, message := range messages {
		//item := make(map[string]interface{})
		var visitor models.Visitor
		var kefu models.User
		if visitor.Name == "" || kefu.Name == "" {
			kefu = models.FindUser(message.KefuId)
			visitor = models.FindVisitorByVistorId(message.VisitorId)
		}
		var chatMessage ChatMessage
		chatMessage.Time = message.CreatedAt.Format("2006-01-02 15:04:05")
		chatMessage.Content = message.Content
		chatMessage.MesType = message.MesType
		if message.MesType == "kefu" {
			chatMessage.Name = kefu.Nickname
			chatMessage.Avator = kefu.Avator
		} else {
			chatMessage.Name = visitor.Name
			chatMessage.Avator = visitor.Avator
		}
		chatMessages = append(chatMessages, chatMessage)
	}
	models.ReadMessageByVisitorId(visitorId)
	c.JSON(200, gin.H{
		"code":   200,
		"msg":    "ok",
		"result": chatMessages,
	})
}
