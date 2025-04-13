Page({
  data: {
    username: '',
    password: '',
    // 预设员工信息仅作为提示，实际验证使用数据库
    presetStaff: {
      'A': { password: '1234567890', name: '员工A' },
      'B': { password: '1234567890', name: '员工B' },
      'C': { password: '1234567890', name: '员工C' }
    }
  },

  // 输入工号
  inputUsername(e) {
    this.setData({
      username: e.detail.value
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
    const { username, password } = this.data;
    
    if (!username || !password) {
      wx.showToast({
        title: '请输入工号和密码',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    console.log('尝试登录员工账号:', username);
    
    // 所有账号都从数据库验证
    this.verifyStaffInDatabase(username, password);
  },

  // 在数据库中验证员工信息
  verifyStaffInDatabase(username, password) {
    const db = wx.cloud.database();
    db.collection('staff')
      .where({
        staff_id: username
      })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          const staffInfo = res.data[0];
          
          // TODO: 应该使用加密比对，这里简化处理
          if (password === staffInfo.password) {
            // 查询用户表中的员工信息
            return db.collection('users')
              .where({
                _openid: staffInfo._openid
              })
              .get()
              .then(userRes => {
                let userInfo;
                
                // 如果用户表中没有员工信息，创建一个
                if (userRes.data.length === 0) {
                  return db.collection('users').add({
                    data: {
                      userType: 'staff',
                      nickName: staffInfo.name,
                      avatarUrl: staffInfo.avatar || '/images/staff-avatar.png',
                      wallet_balance: 0,
                      remaining_times: 0,
                      create_time: db.serverDate(),
                      update_time: db.serverDate()
                    }
                  }).then(() => staffInfo);
                } else {
                  return staffInfo;
                }
              });
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '密码错误',
              icon: 'none'
            });
            return Promise.reject('密码错误');
          }
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '工号不存在',
            icon: 'none'
          });
          return Promise.reject('工号不存在');
        }
      })
      .then(staffInfo => {
        // 保存登录状态和员工信息
        wx.setStorageSync('isLoggedIn', true);
        wx.setStorageSync('userType', 'staff');
        // 确保员工信息格式一致
        wx.setStorageSync('staffInfo', {
            ...staffInfo,
            staff_id: staffInfo.staff_id,
            name: staffInfo.name,
            isStaff: true, // 明确设置员工权限
            role: staffInfo.role || 'staff'
        });
        wx.setStorageSync('staffId', staffInfo.staff_id);
        wx.setStorageSync('isStaffLoggedIn', true); // 设置员工登录标志
        
        wx.hideLoading();
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500,
          success: () => {
            setTimeout(() => {
              // 调用登录成功的处理方法
              this.loginSuccess(staffInfo);
            }, 1500);
          }
        });
      })
      .catch(err => {
        console.error('登录失败：', err);
        // 错误已在前面处理，这里不需要额外处理
      });
  },

  // 员工登录成功后
  loginSuccess(staffData) {
    // 保存员工信息到本地存储
    wx.setStorageSync('staffInfo', staffData);
    wx.setStorageSync('isStaffLoggedIn', true);
    
    console.log('员工登录成功，信息已保存:', staffData);
    
    // 检查是否有需要返回的页面
    const returnPage = wx.getStorageSync('loginReturnPage');
    if (returnPage) {
      wx.removeStorageSync('loginReturnPage');
      console.log('登录成功，将返回到:', returnPage);
      
      wx.navigateTo({
        url: returnPage,
        success: function() {
          console.log('成功返回到', returnPage);
        },
        fail: function(error) {
          console.error('返回页面失败:', error);
          // 如果返回失败，则回到员工首页
          wx.reLaunch({
            url: '/pages/staff/staff',
            success: function() {
              console.log('已跳转到员工主页');
            }
          });
        }
      });
    } else {
      // 没有指定返回页面，直接跳转到员工页面
      wx.reLaunch({
        url: '/pages/staff/staff',
        success: function() {
          console.log('已跳转到员工主页');
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500
          });
        }
      });
    }
  }
});