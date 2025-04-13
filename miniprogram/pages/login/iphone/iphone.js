Page({
  // 微信手机号快捷登录
  getPhoneNumber(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 模拟用户信息
      const userInfo = {
        id: 'user_' + new Date().getTime(),
        nickName: '微信用户',
        balance: 0,
        sessions: 0
      };
      
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('userInfo', userInfo);
      
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          // 跳转到会员页面
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/member/member'
            });
          }, 1500);
        }
      });
    } else {
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    }
  }
}); 