// pages/login/login.js
const app = getApp()

Page({
  data: {
    name: '',
    phone: '',
    role: 'salesperson', // 默认业务员
    loading: false,
    pendingUser: null, // 登录成功后暂存用户信息
    agreed: false, // 是否同意隐私协议
    logoError: false // Logo 图片是否加载失败
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

  // 切换协议勾选
  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  // 跳转隐私政策
  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  // 跳转用户服务协议
  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  },

  // Logo 图片加载失败时隐藏（不影响页面渲染）
  onLogoError() {
    this.setData({ logoError: true })
  },

  onLogin() {
    const { name, phone, role, agreed } = this.data

    if (!agreed) {
      wx.showToast({ title: '请先阅读并同意《隐私政策》和《用户服务协议》', icon: 'none' })
      return
    }

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

        const requestUrl = `${app.globalData.serverUrl}/api/user/register`

        // 第二步：发送到后端换取 openid 并注册用户
        wx.request({
          url: requestUrl,
          method: 'POST',
          data: { code, name, phone, role },
          timeout: 30000,
          success: (res) => {
            if (res.data && res.data.success) {
              const { openid } = res.data.data

              // 保存用户信息到本地
              wx.setStorageSync('userInfo', { name, phone })
              wx.setStorageSync('openid', openid)
              wx.setStorageSync('role', role)
              app.globalData.userInfo = { name, phone }
              app.globalData.openid = openid
              app.globalData.role = role

              // 暂存用户信息，等待用户点击授权按钮
              this.setData({
                loading: false,
                pendingUser: { openid, name, phone, role },
                showSubscribeModal: true
              })
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

  // 用户点击「授权通知」按钮
  onAuthorizeSubscribe() {
    const { pendingUser } = this.data
    if (!pendingUser) return

    this.requestSubscribe(pendingUser.openid, pendingUser.name, pendingUser.phone, pendingUser.role)
  },

  // 用户跳过授权
  onSkipSubscribe() {
    const { pendingUser } = this.data
    if (!pendingUser) return

    // 通知后端用户拒绝订阅
    wx.request({
      url: `${app.globalData.serverUrl}/api/user/subscribe`,
      method: 'POST',
      data: {
        openid: pendingUser.openid,
        subscribed: false,
        templateId: '3190quZoGppQAekXMUcnLYUwdyG1C7nLgLJmsjoCkcA'
      },
      success: () => {
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index/index' })
        }, 1500)
      },
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' })
      }
    })
  },

  requestSubscribe(openid, name, phone, role) {
    // 申请订阅消息权限（必须由用户点击触发）
    wx.requestSubscribeMessage({
      tmplIds: ['3190quZoGppQAekXMUcnLYUwdyG1C7nLgLJmsjoCkcA'],
      success: (subRes) => {
        const accepted = subRes['3190quZoGppQAekXMUcnLYUwdyG1C7nLgLJmsjoCkcA'] === 'accept'

        // 通知后端订阅状态
        wx.request({
          url: `${app.globalData.serverUrl}/api/user/subscribe`,
          method: 'POST',
          data: {
            openid,
            subscribed: accepted,
            templateId: '3190quZoGppQAekXMUcnLYUwdyG1C7nLgLJmsjoCkcA'
          },
          success: () => {
            if (accepted) {
              wx.showToast({ title: '登录成功！', icon: 'success' })
            } else {
              wx.showModal({
                title: '提示',
                content: '您未授权通知，将无法收到行程推送。可在首页重新授权。',
                showCancel: false,
                success: () => {
                  wx.reLaunch({ url: '/pages/index/index' })
                }
              })
              return
            }

            // 跳转到任务页
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/index/index' })
            }, 1500)
          },
          fail: () => {
            wx.reLaunch({ url: '/pages/index/index' })
          }
        })
      },
      fail: (err) => {
        console.error('订阅消息失败', err)
        wx.showModal({
          title: '提示',
          content: '订阅失败，仍可登录。您可以在首页重新授权。',
          showCancel: false,
          success: () => {
            wx.reLaunch({ url: '/pages/index/index' })
          }
        })
      }
    })
  }
})
