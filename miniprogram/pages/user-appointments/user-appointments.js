Page({
  data: {
    userId: '',
    phoneNumber: '',
    appointments: [],
    showAppointmentsList: false,
    loading: false,
    currentTab: 'active' // active, history
  },

  onLoad(options) {
    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 如果传递了用户ID和手机号，直接查询预约
    if (options.userId && options.phone) {
      this.setData({
        userId: options.userId,
        phoneNumber: options.phone
      });
      this.loadUserAppointments(options.userId);
    }
  },

  onShow() {
    // 如果有用户ID，刷新预约数据
    if (this.data.userId) {
      this.loadUserAppointments(this.data.userId);
    }
  },

  // 输入手机号
  inputPhoneNumber(e) {
    this.setData({
      phoneNumber: e.detail.value
    });
  },

  // 搜索用户预约
  searchAppointments() {
    const { phoneNumber } = this.data;
    
    if (!phoneNumber || phoneNumber.length !== 11) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    
    // 先查询用户信息
    db.collection('users')
      .where({
        phone: phoneNumber
      })
      .get()
      .then(res => {
        if (res.data.length === 0) {
          wx.showToast({
            title: '未找到该用户',
            icon: 'none'
          });
          this.setData({ 
            loading: false,
            showAppointmentsList: false
          });
          return;
        }
        
        const user = res.data[0];
        this.setData({ userId: user._id });
        
        // 查询用户预约
        return this.loadUserAppointments(user._id);
      })
      .catch(err => {
        console.error('查询用户失败:', err);
        wx.showToast({
          title: '查询失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },

  // 加载用户预约
  loadUserAppointments(userId) {
    const db = wx.cloud.database();
    const _ = db.command;
    const currentTab = this.data.currentTab;
    
    let statusCondition;
    if (currentTab === 'active') {
      statusCondition = _.in(['pending', 'confirmed']);
    } else {
      statusCondition = _.in(['completed', 'cancelled']);
    }
    
    // 查询该用户的预约记录
    return db.collection('appointments')
      .where({
        user_id: userId,
        status: statusCondition
      })
      .orderBy('appointment_date', 'asc')
      .orderBy('time_slot', 'asc')
      .get()
      .then(res => {
        if (res.data.length === 0) {
          wx.showToast({
            title: `没有${currentTab === 'active' ? '有效' : '历史'}预约`,
            icon: 'none'
          });
        }
        
        // 格式化预约数据
        const appointments = res.data.map(item => ({
          _id: item._id,
          serviceName: item.service_name,
          date: item.appointment_date,
          timeSlot: item.time_slot,
          status: this.formatStatus(item.status),
          price: item.price,
          rawStatus: item.status // 保存原始状态用于条件判断
        }));
        
        this.setData({
          appointments,
          showAppointmentsList: true,
          loading: false
        });
      })
      .catch(err => {
        console.error('查询预约失败:', err);
        wx.showToast({
          title: '查询失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },
  
  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    
    if (this.data.userId) {
      this.loadUserAppointments(this.data.userId);
    }
  },
  
  // 格式化状态
  formatStatus(status) {
    const statusMap = {
      'pending': '待处理',
      'confirmed': '已确认',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  },
  
  // 更改预约时间
  changeAppointmentTime(e) {
    const appointmentId = e.currentTarget.dataset.id;
    const appointment = this.data.appointments.find(item => item._id === appointmentId);
    
    if (!appointment) {
      wx.showToast({
        title: '预约信息不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/change-appointment/change-appointment?id=${appointmentId}&date=${appointment.date}&time=${appointment.timeSlot}`
    });
  },
  
  // 核销预约
  verifyAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认核销',
      content: '确定要核销这个预约吗？',
      success: res => {
        if (res.confirm) {
          this.doVerifyAppointment(appointmentId);
        }
      }
    });
  },
  
  // 执行核销
  doVerifyAppointment(appointmentId) {
    const db = wx.cloud.database();
    const staffInfo = wx.getStorageSync('staffInfo');
    
    // 检查员工信息
    if (!staffInfo || !staffInfo._id) {
      wx.showToast({
        title: '员工信息不完整',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '核销中...',
      mask: true
    });
    
    db.collection('appointments')
      .doc(appointmentId)
      .update({
        data: {
          status: 'completed',
          complete_time: db.serverDate(),
          verified_by: staffInfo._id || '',
          verified_by_name: staffInfo.name || '员工'
        }
      })
      .then(() => {
        // 更新本地数据
        const { appointments } = this.data;
        const newAppointments = appointments.map(item => {
          if (item._id === appointmentId) {
            return {
              ...item,
              status: '已完成',
              rawStatus: 'completed'
            };
          }
          return item;
        });
        
        this.setData({
          appointments: newAppointments
        });
        
        // 创建核销记录
        return db.collection('verifications').add({
          data: {
            appointment_id: appointmentId,
            verification_method: 'manual',
            verification_code: '',
            verify_time: db.serverDate(),
            verified_by: staffInfo._id || '',
            verified_by_name: staffInfo.name || '员工'
          }
        });
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '核销成功',
          icon: 'success'
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('核销失败:', err);
        wx.showToast({
          title: '核销失败',
          icon: 'none'
        });
      });
  },
  
  // 取消预约
  cancelAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个预约吗？',
      success: res => {
        if (res.confirm) {
          this.doCancelAppointment(appointmentId);
        }
      }
    });
  },
  
  // 执行取消
  doCancelAppointment(appointmentId) {
    const db = wx.cloud.database();
    const staffInfo = wx.getStorageSync('staffInfo');
    
    // 检查员工信息
    if (!staffInfo || !staffInfo._id) {
      wx.showToast({
        title: '员工信息不完整',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '取消中...',
      mask: true
    });
    
    db.collection('appointments')
      .doc(appointmentId)
      .update({
        data: {
          status: 'cancelled',
          cancel_time: db.serverDate(),
          cancelled_by: staffInfo._id || '',
          cancelled_by_name: staffInfo.name || '员工',
          cancel_reason: '员工取消'
        }
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '取消成功',
          icon: 'success'
        });
        
        // 更新本地数据
        const { appointments } = this.data;
        const newAppointments = appointments.map(item => {
          if (item._id === appointmentId) {
            return {
              ...item,
              status: '已取消',
              rawStatus: 'cancelled'
            };
          }
          return item;
        });
        
        this.setData({
          appointments: newAppointments
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('取消失败:', err);
        wx.showToast({
          title: '取消失败',
          icon: 'none'
        });
      });
  },
  
  // 刷新预约数据
  refreshAppointments() {
    if (this.data.userId) {
      this.loadUserAppointments(this.data.userId);
    } else {
      wx.showToast({
        title: '请先搜索用户',
        icon: 'none'
      });
    }
  }
}) 