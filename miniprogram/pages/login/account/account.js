Page({
  data: {
    phone: '',
    password: '',
    loading: false
  },

  // 输入手机号/账号
  inputPhone(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  // 输入密码
  inputPassword(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 登录方法
  handleLogin() {
    const { phone, password } = this.data;
    
    if (!phone || !password) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    console.log('尝试账号登录:', phone);

    // 先获取用户的openid
    wx.cloud.callFunction({
      name: 'getWXContext',
      success: wxContextRes => {
        console.log('获取WXContext成功:', wxContextRes.result);
        const openid = wxContextRes.result.openid;
        
        if (!openid) {
          console.error('获取openid失败，返回结果:', wxContextRes.result);
          wx.hideLoading();
          wx.showToast({
            title: '登录失败，无法获取用户标识',
            icon: 'none'
          });
          return;
        }
        
        // 保存openid到缓存
        wx.setStorageSync('wxContext', wxContextRes.result);
        console.log('已保存openid到缓存:', openid);

        // 验证超级管理员账号
        const db = wx.cloud.database();
        db.collection('users')
          .where({
            phone: phone,
            userType: 'admin'
          })
          .get()
          .then(res => {
            if (res.data.length > 0) {
              // TODO: 应该使用加密比对，这里简化处理
              if (password === '1234567890') {  // 应改为实际密码或加密比对
                const adminInfo = res.data[0];
                
                // 检查是否需要更新openid
                if (!adminInfo._openid || adminInfo._openid !== openid) {
                  console.log(`更新管理员openid: ${adminInfo._openid || '无'} -> ${openid}`);
                  db.collection('users').doc(adminInfo._id).update({
                    data: {
                      _openid: openid,
                      update_time: db.serverDate()
                    }
                  }).then(() => {
                    console.log('管理员openid更新成功');
                  }).catch(err => {
                    console.error('更新openid失败:', err);
                  });
                  
                  // 更新本地对象的openid，确保后续操作使用更新后的信息
                  adminInfo._openid = openid;
                }
                
                // 保存登录状态和管理员信息
                wx.setStorageSync('isLoggedIn', true);
                wx.setStorageSync('userType', 'admin');
                wx.setStorageSync('userInfo', adminInfo);
                wx.setStorageSync('walletBalance', adminInfo.wallet_balance || 0);
                wx.setStorageSync('remainingSessions', adminInfo.remaining_times || 0);
                
                wx.showToast({
                  title: '登录成功',
                  icon: 'success',
                  duration: 1500,
                  success: () => {
                    setTimeout(() => {
                      wx.reLaunch({
                        url: '/pages/member/member'
                      });
                    }, 1500);
                  }
                });
              } else {
                wx.hideLoading();
                wx.showToast({
                  title: '密码错误',
                  icon: 'none'
                });
              }
            } else {
              // 尝试创建超级管理员账号（仅在第一次使用时）
              if (phone === 'admin' && password === '1234567890') {
                db.collection('users').add({
                  data: {
                    _openid: openid, // 确保添加openid字段
                    phone: phone,
                    userType: 'admin',
                    nickName: '管理员',
                    avatarUrl: '/images/admin-avatar.png',
                    wallet_balance: 1000,
                    service_times: {
                      basic_60: 3,
                      basic_90: 2,
                      advanced_60: 3,
                      advanced_90: 2
                    },
                    remaining_times: 10,
                    is_staff: true,
                    is_admin: true,
                    role: 'admin',
                    create_time: db.serverDate(),
                    update_time: db.serverDate()
                  }
                }).then((addRes) => {
                  // 使用新创建的记录ID获取完整数据
                  return db.collection('users').doc(addRes._id).get();
                }).then((res) => {
                  const adminInfo = res.data;
                  
                  // 保存登录状态和管理员信息
                  wx.setStorageSync('isLoggedIn', true);
                  wx.setStorageSync('userType', 'admin');
                  wx.setStorageSync('userInfo', adminInfo);
                  wx.setStorageSync('walletBalance', adminInfo.wallet_balance);
                  wx.setStorageSync('remainingSessions', adminInfo.remaining_times);
                  
                  wx.hideLoading();
                  wx.showToast({
                    title: '登录成功',
                    icon: 'success',
                    duration: 1500,
                    success: () => {
                      setTimeout(() => {
                        wx.reLaunch({
                          url: '/pages/member/member'
                        });
                      }, 1500);
                    }
                  });
                }).catch(err => {
                  wx.hideLoading();
                  console.error('创建管理员账号失败：', err);
                  wx.showToast({
                    title: '登录失败',
                    icon: 'none'
                  });
                });
              } else {
                wx.hideLoading();
                wx.showToast({
                  title: '账号不存在',
                  icon: 'none'
                });
              }
            }
          })
          .catch(err => {
            wx.hideLoading();
            console.error('登录失败：', err);
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
          });
      },
      fail: err => {
        wx.hideLoading();
        console.error('获取用户openid失败:', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      }
    });
  }
}); 