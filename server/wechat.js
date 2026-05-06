// server/wechat.js - 微信 API 封装
import axios from 'axios'

let accessToken = null
let tokenExpireTime = 0

// 获取 access_token（带缓存，有效期2小时）
export async function getAccessToken(appid, secret) {
  const now = Date.now()
  if (accessToken && now < tokenExpireTime) {
    return accessToken
  }

  const res = await axios.get(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`
  )

  if (res.data.access_token) {
    accessToken = res.data.access_token
    tokenExpireTime = now + (res.data.expires_in - 300) * 1000 // 提前5分钟刷新
    return accessToken
  }

  throw new Error(`获取 access_token 失败: ${JSON.stringify(res.data)}`)
}

// 用 code 换取 openid
export async function getOpenid(appid, secret, code) {
  const res = await axios.get(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
  )

  if (res.data.openid) {
    return res.data.openid
  }

  throw new Error(`获取 openid 失败: ${JSON.stringify(res.data)}`)
}

// 发送订阅消息
export async function sendSubscribeMessage({ accessToken, openid, templateId, page, data }) {
  const res = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
    {
      touser: openid,
      template_id: templateId,
      page: page || 'pages/index/index',
      data
    }
  )

  if (res.data.errcode !== 0) {
    throw new Error(`推送失败: ${res.data.errmsg} (${res.data.errcode})`)
  }

  return true
}
