Page({
  data: {
    appointmentId: '',
    appointmentInfo: null,
    currentDate: '',
    currentTime: '',
    newDate: '',
    newTime: '',
    timeSlots: [
      '9:00-10:00', '10:00-11:00', '11:00-12:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00',
      '17:00-18:00', '18:00-19:00', '19:00-20:00'
    ],
    availableTimeSlots: [],
    therapists: [],
    selectedTherapistId: '',
    loading: false,
    isAdmin: false,
    isStaff: false,
    customerAppointments: [], // 顾客的所有预约记录
    showCustomerAppointments: false, // 控制是否显示顾客的预约列表
    userInfo: null, // 顾客信息
    staffAppointments: [] // 当前员工的所有预约
  },
  
  onLoad(options) {
    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 检查用户权限
    this.checkUserPermission();
    
    if (options.id && options.date && options.time) {
      this.setData({
        appointmentId: options.id,
        currentDate: options.date,
        currentTime: options.time,
        newDate: options.date,
        newTime: options.time
      });
      
      // 加载预约详细信息
      this.loadAppointmentInfo(options.id);
      
      // 加载技师列表
      this.loadTherapists();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none',
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    }
  },
  
  // 检查用户权限
  checkUserPermission() {
    const userType = wx.getStorageSync('userType');
    const userInfo = wx.getStorageSync('userInfo');
    
    console.log('用户类型:', userType);
    console.log('用户信息:', userInfo);
    
    if (userType === 'admin' && userInfo && userInfo.is_admin) {
      this.setData({ 
        isAdmin: true,
        isStaff: true,
        userInfo: userInfo
      });
      console.log('当前用户是管理员');
    } else if (userType === 'staff' && userInfo && userInfo.is_staff) {
      // 确保员工有正确的ID
      const staffId = userInfo._id || userInfo.openid;
      console.log('员工ID:', staffId);
      
      this.setData({ 
        isStaff: true,
        userInfo: userInfo
      });
      
      // 如果是员工，加载员工自己的预约
      if (staffId) {
        this.loadStaffAppointments(staffId);
      } else {
        console.error('员工ID不存在');
      }
    }
  },
  
  // 加载预约详细信息
  loadAppointmentInfo(appointmentId) {
    const db = wx.cloud.database();
    
    db.collection('appointments')
      .doc(appointmentId)
      .get()
      .then(res => {
        this.setData({
          appointmentInfo: res.data,
          selectedTherapistId: res.data.therapist_id || ''
        });
        
        // 管理员或员工可以修改所有预约
        // 普通用户只能修改自己的预约
        if (!this.data.isStaff) {
          const userInfo = wx.getStorageSync('userInfo');
          if (!userInfo || res.data.user_id !== userInfo._id) {
            wx.showModal({
              title: '权限提示',
              content: '您无权修改此预约',
              showCancel: false,
              success: () => {
                wx.navigateBack();
              }
            });
          }
        } else {
          // 员工可以查看顾客的其他预约
          if (res.data.user_id) {
            this.loadCustomerAppointments(res.data.user_id);
          }
        }
      })
      .catch(err => {
        console.error('获取预约信息失败:', err);
        wx.showToast({
          title: '获取预约信息失败',
          icon: 'none'
        });
      });
  },
  
  // 加载顾客的所有预约记录
  loadCustomerAppointments(userId) {
    const db = wx.cloud.database();
    const _ = db.command;
    
    console.log('加载顾客预约 - 顾客ID:', userId);
    console.log('当前员工ID:', this.data.userInfo?._id);
    
    // 查询该顾客的所有预约
    let query = {
      user_id: userId
    };
    
    // 如果是普通员工（非管理员），只查看分配给自己的预约
    if (!this.data.isAdmin && this.data.isStaff) {
      const staffId = this.data.userInfo?._id || this.data.userInfo?.openid;
      if (staffId) {
        query.therapist_id = staffId;
      }
    }
    
    console.log('顾客预约查询条件:', query);
    
    db.collection('appointments')
      .where(query)
      .orderBy('appointment_date', 'desc')
      .orderBy('create_time', 'desc')
      .get()
      .then(res => {
        console.log('顾客的预约记录:', res.data);
        // 格式化预约记录
        const formattedAppointments = res.data.map(item => {
          return {
            ...item,
            statusText: this.getStatusText(item.status)
          };
        });
        
        this.setData({
          customerAppointments: formattedAppointments
        });
      })
      .catch(err => {
        console.error('获取顾客预约记录失败:', err);
      });
  },
  
  // 加载员工自己的预约
  loadStaffAppointments(staffId) {
    const db = wx.cloud.database();
    const _ = db.command;
    
    console.log('加载员工ID的预约:', staffId);
    
    // 获取当前日期（本地时间格式：YYYY-MM-DD）
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    console.log('今日日期:', todayStr);
    
    // 查询今日及以后的预约
    db.collection('appointments')
      .where({
        therapist_id: staffId,
        appointment_date: _.gte(todayStr),
        status: _.in(['pending', 'paid', 'confirmed'])
      })
      .orderBy('appointment_date', 'asc')
      .orderBy('time_slot', 'asc')
      .get()
      .then(res => {
        console.log('员工预约查询结果:', res.data);
        
        if (res.data.length === 0) {
          console.log('未找到员工预约记录');
          
          // 尝试不带状态条件查询
          return db.collection('appointments')
            .where({
              therapist_id: staffId,
              appointment_date: _.gte(todayStr)
            })
            .orderBy('appointment_date', 'asc')
            .get();
        }
        
        return { data: res.data };
      })
      .then(res => {
        if (res.data && res.data.length > 0) {
          console.log('找到员工预约:', res.data.length, '条记录');
          this.setData({
            staffAppointments: res.data
          });
        } else {
          console.log('最终未找到员工预约');
          
          // 检查员工ID是否存在于任何预约中
          db.collection('appointments')
            .where({
              therapist_id: staffId
            })
            .count()
            .then(res => {
              console.log('包含此员工ID的总预约数:', res.total);
            });
        }
      })
      .catch(err => {
        console.error('获取员工预约失败:', err);
      });
  },
  
  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待支付',
      'paid': '已支付',
      'confirmed': '已确认',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  },
  
  // 查看顾客的预约列表
  toggleCustomerAppointments() {
    this.setData({
      showCustomerAppointments: !this.data.showCustomerAppointments
    });
  },
  
  // 加载技师列表
  loadTherapists() {
    const db = wx.cloud.database();
    
    db.collection('therapists')
      .where({
        status: 'active'
      })
      .get()
      .then(res => {
        this.setData({
          therapists: res.data
        });
      })
      .catch(err => {
        console.error('获取技师列表失败:', err);
      });
  },
  
  // 选择新日期
  bindDateChange(e) {
    const newDate = e.detail.value;
    this.setData({
      newDate: newDate
    });
    
    // 加载该日期可用的时间段
    this.loadAvailableTimeSlots(newDate, this.data.selectedTherapistId);
  },
  
  // 选择技师
  selectTherapist(e) {
    const therapistId = e.currentTarget.dataset.id;
    this.setData({
      selectedTherapistId: therapistId
    });
    
    // 重新加载可用时间段
    this.loadAvailableTimeSlots(this.data.newDate, therapistId);
  },
  
  // 加载可用时间段
  loadAvailableTimeSlots(date, therapistId) {
    if (!date) return;
    
    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 默认所有时间段都可用
    let availableSlots = [...this.data.timeSlots];
    
    // 查询条件：同一天，同一技师，状态为待处理或已确认的预约
    let queryCondition = {
      appointment_date: date,
      status: _.in(['pending', 'confirmed'])
    };
    
    // 如果选择了技师，添加技师条件
    if (therapistId) {
      queryCondition.therapist_id = therapistId;
    }
    
    // 排除当前正在修改的预约
    queryCondition._id = _.neq(this.data.appointmentId);
    
    // 查询已有预约
    db.collection('appointments')
      .where(queryCondition)
      .get()
      .then(res => {
        // 找出已被预约的时间段
        const bookedSlots = res.data.map(item => item.time_slot);
        
        // 过滤掉已被预约的时间段
        availableSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));
        
        // 还需要检查技师的休息时间
        if (therapistId) {
          return this.checkTherapistRestTimes(date, therapistId, availableSlots);
        } else {
          return { availableSlots };
        }
      })
      .then(result => {
        this.setData({
          availableTimeSlots: result.availableSlots,
          loading: false
        });
        
        // 如果当前选择的时间段不可用，清空选择
        if (!result.availableSlots.includes(this.data.newTime)) {
          this.setData({
            newTime: ''
          });
        }
      })
      .catch(err => {
        console.error('获取可用时间段失败:', err);
        this.setData({ loading: false });
      });
  },
  
  // 检查技师休息时间
  checkTherapistRestTimes(date, therapistId, availableSlots) {
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 将日期格式化为ISO字符串的开始时间和结束时间
    const startOfDay = new Date(`${date}T00:00:00`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59`).toISOString();
    
    return db.collection('rest_times')
      .where({
        therapist_id: therapistId,
        status: 'active',
        // 休息时间和当天有重叠
        start_date: _.lte(endOfDay),
        end_date: _.gte(startOfDay)
      })
      .get()
      .then(res => {
        if (res.data.length === 0) {
          return { availableSlots };
        }
        
        // 解析时间段，移除与休息时间重叠的时段
        const restTimes = res.data;
        const filteredSlots = [];
        
        for (const slot of availableSlots) {
          const [slotStart, slotEnd] = slot.split('-');
          const slotStartTime = new Date(`${date}T${slotStart}:00`).getTime();
          const slotEndTime = new Date(`${date}T${slotEnd}:00`).getTime();
          
          let isAvailable = true;
          
          for (const restTime of restTimes) {
            const restStartTime = new Date(restTime.start_date).getTime();
            const restEndTime = new Date(restTime.end_date).getTime();
            
            // 检查时间段是否重叠
            if (!(slotEndTime <= restStartTime || slotStartTime >= restEndTime)) {
              isAvailable = false;
              break;
            }
          }
          
          if (isAvailable) {
            filteredSlots.push(slot);
          }
        }
        
        return { availableSlots: filteredSlots };
      });
  },
  
  // 选择新时间段
  selectTimeSlot(e) {
    const time = e.currentTarget.dataset.time;
    
    // 检查该时间段是否可用
    if (this.data.availableTimeSlots.indexOf(time) === -1) {
      wx.showToast({
        title: '该时段已被预约',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      newTime: time
    });
  },
  
  // 确认更改
  confirmChange() {
    const { appointmentId, newDate, newTime, currentDate, currentTime, selectedTherapistId, appointmentInfo } = this.data;
    
    // 如果没有变化，提示用户
    if (newDate === currentDate && newTime === currentTime && selectedTherapistId === (appointmentInfo?.therapist_id || '')) {
      wx.showToast({
        title: '预约信息未更改',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否选择了时间
    if (!newTime) {
      wx.showToast({
        title: '请选择预约时间',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否选择了技师
    if (!selectedTherapistId) {
      wx.showToast({
        title: '请选择技师',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '处理中',
    });
    
    // 处理日期和时间变更
    this.processTimeChange(appointmentId, newDate, newTime, selectedTherapistId);
  },
  
  // 处理时间变更
  processTimeChange(appointmentId, newDate, newTime, therapistId) {
    // 调用云函数更新预约时间
    wx.cloud.callFunction({
      name: 'updateAppointmentTime',
      data: {
        appointmentId,
        newDate,
        newTime,
        therapistId,
        isAdmin: this.data.isAdmin,
        isStaff: this.data.isStaff
      },
      success: res => {
        wx.hideLoading();
        
        const result = res.result;
        if (result.success) {
          wx.showToast({
            title: '预约已更改',
            icon: 'success',
            duration: 1500,
            success: () => {
              setTimeout(() => {
                // 返回上一页
                wx.navigateBack();
              }, 1500);
            }
          });
        } else {
          wx.showToast({
            title: result.message || '更改失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用云函数失败:', err);
        wx.showToast({
          title: '更改失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 返回上一页
  navigateBack() {
    wx.navigateBack();
  }
}) 