// pages/login/login.js
const app = getApp()

Page({
  data: {
    name: '',
    phone: '',
    role: 'salesperson', // 默认业务员
    loading: false
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  selectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role })
  },

  onLogin() {
    const { name, phone, role } = this.data

    // 基础校验
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    // 第一步：获取微信登录 code
    wx.login({
      success: (loginRes) => {
        const code = loginRes.code
        console.log('微信code:', code)

        const requestUrl = `${app.globalData.serverUrl}/api/user/register`
        console.log('请求URL:', requestUrl)

        // 第二步：发送到后端换取 openid 并注册用户
        wx.request({
          url: requestUrl,
          method: 'POST',
          data: { code, name, phone, role },
          timeout: 30000,
          success: (res) => {
            if (res.data && res.data.success) {
              const { openid } = res.data.data

              // 保存用户信息
              wx.setStorageSync('userInfo', { name, phone })
              wx.setStorageSync('openid', openid)
              wx.setStorageSync('role', role)
              app.globalData.userInfo = { name, phone }
              app.globalData.openid = openid
              app.globalData.role = role

              // 第三步：申请订阅消息权限
              this.requestSubscribe(openid, name, phone, role)
            } else {
              wx.showToast({ title: res.data?.message || '登录失败', icon: 'none' })
              this.setData({ loading: false })
            }
          },
          fail: (err) => {
            console.error('请求失败', err)
            wx.showToast({ title: '网络异常，请重试', icon: 'none' })
            this.setData({ loading: false })
          }
        })
      },
      fail: (err) => {
        console.error('微信登录失败', err)
        wx.showToast({ title: '微信登录失败', icon: 'none' })
        this.setData({ loading: false })
      }
    })
  },

  requestSubscribe(openid, name, phone, role) {
    // 申请订阅消息权限
    wx.requestSubscribeMessage({
      tmplIds: ['_axfOU8CQJtAnrHzkPlen7G0myB1KHeDqV-CdcTiIEI'],
      success: (subRes) => {
        const accepted = subRes['_axfOU8CQJtAnrHzkPlen7G0myB1KHeDqV-CdcTiIEI'] === 'accept'

        // 通知后端订阅状态
        wx.request({
          url: `${app.globalData.serverUrl}/api/user/subscribe`,
          method: 'POST',
          data: {
            openid,
            subscribed: accepted,
            templateId: '_axfOU8CQJtAnrHzkPlen7G0myB1KHeDqV-CdcTiIEI'
          },
          success: () => {
            if (accepted) {
              wx.showToast({ title: '登录成功！', icon: 'success' })
            } else {
              wx.showModal({
                title: '提示',
                content: '您未授权通知，将无法收到行程推送。可在设置中重新授权。',
                showCancel: false
              })
            }

            // 跳转到任务页
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/index/index' })
            }, 1500)
          },
          fail: () => {
            // 订阅状态通知失败也继续跳转
            wx.reLaunch({ url: '/pages/index/index' })
          }
        })
      },
      fail: (err) => {
        console.error('订阅消息失败', err)
        // 订阅失败也继续跳转
        wx.reLaunch({ url: '/pages/index/index' })
      }
    })
  }
})
