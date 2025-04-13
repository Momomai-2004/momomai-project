Page({
  data: {
    loading: false,
    selectedTherapistId: '' // 存储选中的理疗师ID
  },

  // 处理获取手机号
  handleGetPhoneNumber(e) {
    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      wx.showToast({
        title: '需要授权手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    // 1. 首先获取登录code
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          // 2. 将code和加密的手机号信息发送到服务器
          wx.request({
            url: 'YOUR_API_ENDPOINT/user/login',
            method: 'POST',
            data: {
              code: loginRes.code,
              encryptedData: e.detail.encryptedData,
              iv: e.detail.iv
            },
            success: (res) => {
              if (res.data.success) {
                // 保存用户信息和token
                wx.setStorageSync('token', res.data.data.token);
                wx.setStorageSync('userInfo', res.data.data.userInfo);

                wx.showToast({
                  title: '登录成功',
                  icon: 'success',
                  duration: 1500
                });

                // 延迟返回会员页面
                setTimeout(() => {
                  wx.navigateBack({
                    delta: 1,
                    fail: () => {
                      // 如果返回失败，则跳转到会员页
                      wx.reLaunch({
                        url: '/pages/member/member'
                      });
                    }
                  });
                }, 1500);
              } else {
                wx.showToast({
                  title: res.data.message || '登录失败',
                  icon: 'none'
                });
              }
            },
            fail: () => {
              wx.showToast({
                title: '网络错误',
                icon: 'none'
              });
            },
            complete: () => {
              this.setData({ loading: false });
            }
          });
        } else {
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
          this.setData({ loading: false });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    });
  },

  // 切换到员工登录
  switchToStaffLogin() {
    wx.navigateTo({
      url: '/pages/staff/staff',
      fail: (error) => {
        console.error('跳转失败:', error);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 切换到账号登录
  switchToAccountLogin() {
    wx.navigateTo({
      url: '/pages/login/account/account',
      fail: (error) => {
        console.error('跳转失败:', error);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 接收理疗师ID参数
  onLoad(options) {
    if (options.therapistId) {
      this.setData({
        selectedTherapistId: options.therapistId
      });
    }
  },

  // 微信手机号登录
  getPhoneNumber(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      console.log('获取手机号码成功');
      
      wx.showLoading({
        title: '登录中...',
        mask: true
      });
      
      // 调用云函数获取解密后的手机号
      wx.cloud.callFunction({
        name: 'getPhoneNumber',
        data: {
          weRunData: wx.cloud.CloudID(e.detail.cloudID)
        }
      }).then(res => {
        console.log('解密手机号成功：', res.result);
        const phone = res.result.phoneNumber;
        
        // 先获取用户的openid
        return wx.cloud.callFunction({
          name: 'getWXContext'
        }).then(wxContextRes => {
          console.log('获取WXContext成功:', wxContextRes.result);
          const openid = wxContextRes.result.openid;
          
          if (!openid) {
            console.error('获取openid失败，返回结果:', wxContextRes.result);
            throw new Error('获取用户openid失败');
          }
          
          // 保存openid到缓存
          wx.setStorageSync('wxContext', wxContextRes.result);
          console.log('已保存openid到缓存:', openid);
          
          // 查询用户是否已存在
          const db = wx.cloud.database();
          
          // 首先通过openid查询
          return db.collection('users').where({
            _openid: openid
          }).get().then(openidRes => {
            console.log('通过openid查询结果:', openidRes.data);
            
            if (openidRes.data && openidRes.data.length > 0) {
              console.log('通过openid找到用户:', openidRes.data[0]);
              
              // 确保手机号是最新的
              const userData = openidRes.data[0];
              if (userData.phone !== phone) {
                console.log(`更新用户手机号: ${userData.phone} -> ${phone}`);
                return db.collection('users').doc(userData._id).update({
                  data: {
                    phone: phone,
                    update_time: db.serverDate()
                  }
                }).then(() => {
                  userData.phone = phone;
                  return userData;
                });
              }
              
              return userData;
            }
            
            // 如果通过openid没找到，尝试通过手机号查询
            return db.collection('users').where({
              phone: phone
            }).get().then(userRes => {
              console.log('通过手机号查询结果:', userRes.data);
              
              if (userRes.data && userRes.data.length > 0) {
                // 用户已存在，更新openid
                console.log('通过手机号找到用户，更新openid');
                const userData = userRes.data[0];
                
                // 检查是否需要更新openid
                if (!userData._openid || userData._openid !== openid) {
                  console.log(`更新用户openid: ${userData._openid || '无'} -> ${openid}`);
                  return db.collection('users').doc(userData._id).update({
                    data: {
                      _openid: openid,
                      update_time: db.serverDate()
                    }
                  }).then(() => {
                    userData._openid = openid;
                    return userData;
                  });
                }
                
                return userData;
              } else {
                // 用户不存在，创建新用户
                console.log('创建新用户, openid:', openid, '手机号:', phone);
                return db.collection('users').add({
                  data: {
                    _openid: openid,
                    phone: phone,
                    userType: 'customer', // 默认为普通用户
                    nickName: '微信用户',
                    wallet_balance: 0,
                    remaining_times: 0,
                    service_times: {
                      basic_60: 0,
                      basic_90: 0,
                      advanced_60: 0,
                      advanced_90: 0
                    },
                    create_time: db.serverDate(),
                    update_time: db.serverDate()
                  }
                }).then(addRes => {
                  // 获取新创建的用户信息
                  console.log('用户创建成功, ID:', addRes._id);
                  return db.collection('users').doc(addRes._id).get().then(newUser => {
                    return newUser.data;
                  });
                });
              }
            });
          });
        });
      }).then(userInfo => {
        console.log('最终用户信息:', userInfo);
        
        // 保存用户权限和信息
        const result = this.setUserPermissions(userInfo);
        
        wx.hideLoading();
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500,
          success: () => {
            // 根据用户角色跳转到不同页面
            setTimeout(() => {
              if (userInfo.userType === 'staff') {
                wx.redirectTo({
                  url: '/pages/staff-index/staff-index'
                });
              } else if (userInfo.userType === 'admin') {
                wx.redirectTo({
                  url: '/pages/staff/staff'
                });
              } else {
                wx.switchTab({
                  url: '/pages/index/index'
                });
              }
            }, 1500);
          }
        });
        
        return result;
      }).catch(err => {
        console.error('登录失败：', err);
        wx.hideLoading();
        wx.showModal({
          title: '登录失败',
          content: '获取用户信息失败，请重试',
          showCancel: false
        });
      });
    } else {
      wx.showToast({
        title: '授权失败，请重试',
        icon: 'none'
      });
    }
  },

  // 设置用户权限
  setUserPermissions(userInfo) {
    // 保存用户信息和登录状态
    wx.setStorageSync('isLoggedIn', true);
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('userType', userInfo.userType);
    wx.setStorageSync('walletBalance', userInfo.wallet_balance || 0);
    wx.setStorageSync('remainingSessions', userInfo.remaining_times || 0);
    
    return userInfo;
  },

  // 员工登录
  goToStaffLogin() {
    wx.navigateTo({
      url: '/pages/login/staff/staff',
      fail: (err) => {
        console.error('跳转失败：', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 如果需要账号登录功能，请使用员工登录页面
  goToAccountLogin() {
    wx.navigateTo({
      url: '/pages/login/staff/staff',
      fail: (err) => {
        console.error('跳转失败：', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
}); 