Page({
  data: {
    verifyMethod: 'code', // 'code' 或 'scan'
    verifyCode: '',
    verifyHistory: [
      {
        id: 1,
        serviceName: '基础拉伸60分钟',
        verifyTime: '2024-01-20 14:30'
      }
    ]
  },

  // 切换核销方式
  switchMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ verifyMethod: method });
  },

  // 处理券码输入
  onCodeInput(e) {
    this.setData({
      verifyCode: e.detail.value
    });
  },

  // 券码核销
  verifyCode() {
    // 检查操作权限
    const app = getApp();
    if (!app.checkActionPermission('verify')) {
      wx.showToast({
        title: '您没有核销权限',
        icon: 'none'
      });
      return;
    }
    
    const code = this.data.verifyCode.trim();
    if (!code) {
      wx.showToast({
        title: '请输入核销码',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '核销中...',
      mask: true
    });

    // 查询预约记录
    const db = wx.cloud.database();
    db.collection('appointments')
      .where({
        order_no: code,
        status: db.command.in(['pending', 'confirmed'])
      })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          const appointment = res.data[0];
          
          // 更新预约状态为已完成
          return db.collection('appointments').doc(appointment._id).update({
            data: {
              status: 'completed',
              update_time: db.serverDate()
            }
          }).then(updateRes => {
            // 创建核销记录
            return db.collection('verifications').add({
              data: {
                appointment_id: appointment._id,
                service_name: appointment.service_name,
                verify_method: 'code',
                code: code,
                verified_by: wx.cloud.getWXContext().OPENID,
                verified_time: db.serverDate(),
                create_time: db.serverDate()
              }
            });
          }).then(addRes => {
            wx.hideLoading();
            wx.showToast({
              title: '核销成功',
              icon: 'success'
            });
            // 清空输入
            this.setData({ verifyCode: '' });
            // 刷新核销记录
            this.loadVerifyHistory();
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '未找到有效预约',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('核销失败：', err);
        wx.showToast({
          title: '核销失败',
          icon: 'none'
        });
      });
  },

  // 扫码核销
  scanCode() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        console.log('扫码结果:', res);
        // 处理扫码结果
        this.handleScanResult(res.result);
      },
      fail: (err) => {
        console.error('扫码失败:', err);
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  },

  // 处理扫码结果
  handleScanResult(code) {
    // 使用扫描的二维码内容进行核销
    this.setData({ verifyCode: code });
    this.verifyCode();
  },

  // 加载核销记录
  loadVerifyHistory() {
    // 检查页面访问权限
    if (!this.checkPagePermission()) {
      return;
    }
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    const db = wx.cloud.database();
    
    // 查询最近的核销记录
    db.collection('verifications')
      .where({
        verified_by: wx.cloud.getWXContext().OPENID
      })
      .orderBy('verified_time', 'desc')
      .limit(10)
      .get()
      .then(res => {
        const verifyHistory = res.data.map(item => {
          return {
            id: item._id,
            serviceName: item.service_name,
            verifyTime: this.formatDateTime(item.verified_time)
          };
        });
        
        this.setData({ verifyHistory });
        wx.hideLoading();
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取核销记录失败：', err);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
  },

  // 格式化日期时间
  formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    
    const date = new Date(dateTimeStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 检查页面访问权限
  checkPagePermission() {
    const app = getApp();
    if (!app.checkPagePermission('verification')) {
      wx.showToast({
        title: '您没有权限访问此页面',
        icon: 'none',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 2000);
        }
      });
      return false;
    }
    return true;
  }
}); 