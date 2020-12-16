package controller

import (
	"context"
	"fmt"
	"github.com/gin-gonic/gin"

	"github.com/taoshihan1991/imaptool/tools"
	"github.com/tencentyun/cos-go-sdk-v5"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

var CosClient *cos.Client

type TencentCos struct {
	Client *cos.Client
	C      *gin.Context
}

func NewCosClient(c *gin.Context) *TencentCos {
	if CosClient != nil {
		return &TencentCos{
			CosClient,
			c,
		}
	}
	u, _ := url.Parse(os.Getenv("EndPoint"))
	b := &cos.BaseURL{BucketURL: u}
	// 2.临时密钥
	client := cos.NewClient(b, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  os.Getenv("SecretID"),
			SecretKey: os.Getenv("SecretKey"),
		},
	})
	fmt.Println(os.Getenv("EndPoint"))
	fmt.Println(os.Getenv("SecretID"))
	fmt.Println(os.Getenv("SecretKey"))

	if client == nil {
		panic("CosClient Error")
	}
	CosClient = client
	return &TencentCos{
		client,
		c,
	}
}

func (t *TencentCos) Upload() {
	f, err := t.C.FormFile("imgfile")
	if err != nil {
		t.C.JSON(200, gin.H{
			"code": 400,
			"msg":  "上传失败!",
		})
		return
	} else {
		fileExt := strings.ToLower(path.Ext(f.Filename))
		if fileExt != ".png" && fileExt != ".jpg" && fileExt != ".gif" && fileExt != ".jpeg" {
			t.C.JSON(200, gin.H{
				"code": 400,
				"msg":  "上传失败!只允许png,jpg,gif,jpeg文件",
			})
			return
		}
		r, e := f.Open()
		if e != nil {
			t.C.JSON(200, gin.H{
				"code": -1,
				"msg":  e.Error(),
				"result": gin.H{
					"path": "",
				},
			})
			return
		}
		defer r.Close()
		fileName := tools.Md5(fmt.Sprintf("%s%s", f.Filename, time.Now().String()))
		filePath := "/" + time.Now().Format("2006/01/") + fileName + fileExt
		fmt.Println(filePath)
		opt := &cos.ObjectPutOptions{
			ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
				ContentType: "image/jpeg",
			},
		}
		response, err := t.Client.Object.Put(context.Background(), filePath, r, opt)
		if err != nil {
			t.C.JSON(200, gin.H{
				"code": -1,
				"msg":  err.Error(),
				"result": gin.H{
					"path": filePath,
				},
			})
			return
		}
		if response.StatusCode != http.StatusOK {
			t.C.JSON(200, gin.H{
				"code": -1,
				"msg":  "上传失败!",
				"result": gin.H{
					"path": filePath,
				},
			})
			return
		}
		t.C.JSON(200, gin.H{
			"code": 200,
			"msg":  "上传成功!",
			"result": gin.H{
				"path": filePath,
			},
		})
	}
	return
}
