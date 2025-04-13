Page({
  data: {
    staffInfo: {},
    restOptions: [
      { value: 1, label: '1小时' },
      { value: 24, label: '1天' },
      { value: 48, label: '2天' },
      { value: 168, label: '7天' }
    ],
    selectedOption: 1,
    startDate: '',
    startTime: '',
    restTimes: [] // 已设置的休息时间
  },

  onLoad() {
    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    this.loadStaffInfo();
    this.setDefaultDateTime();
  },

  // 加载员工信息
  loadStaffInfo() {
    const staffInfo = wx.getStorageSync('staffInfo');
    console.log('获取到的员工信息:', staffInfo);
    
    if (staffInfo && staffInfo.staff_id) {
      this.setData({ staffInfo });
      console.log('员工信息已设置, ID:', staffInfo.staff_id);
      // 员工信息完整，加载休息时间
      this.loadRestTimes();
    } else {
      // 如果员工信息不完整，尝试从数据库重新获取
      const db = wx.cloud.database();
      const staffId = wx.getStorageSync('staffId');
      
      console.log('尝试使用staffId获取员工信息:', staffId);
      
      if (staffId) {
        this.getStaffFromDatabase(staffId);
      } else {
        wx.showToast({
          title: '未找到员工信息',
          icon: 'none',
          success: () => {
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }
        });
      }
    }
  },
  
  // 从数据库获取员工信息
  getStaffFromDatabase(staffId) {
    const db = wx.cloud.database();
    
    db.collection('staff')
      .where({ staff_id: staffId })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          const staffInfo = res.data[0];
          
          // 更新缓存和页面数据
          wx.setStorageSync('staffInfo', staffInfo);
          wx.setStorageSync('staffId', staffId);
          this.setData({ staffInfo });
          
          console.log('已从数据库获取员工信息:', staffInfo);
          
          // 加载休息时间
          this.loadRestTimes();
        } else {
          wx.showToast({
            title: '员工ID不存在于数据库',
            icon: 'none'
          });
          this.showErrorAndGoBack();
        }
      })
      .catch(err => {
        console.error('获取员工信息失败:', err);
        this.showErrorAndGoBack();
      });
  },

  showErrorAndGoBack() {
    wx.showToast({
      title: '未找到员工信息',
      icon: 'none',
      success: () => {
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  },

  // 加载已设置的休息时间
  loadRestTimes() {
    const db = wx.cloud.database();
    const _ = db.command;
    const staffInfo = this.data.staffInfo;
    
    if (!staffInfo || !staffInfo._id) return;
    
    // 获取当前时间
    const now = new Date();
    
    db.collection('rest_times')
      .where({
        therapist_id: staffInfo._id,
        end_date: _.gt(now.toISOString()), // 只获取未结束的休息时间
        status: 'active'
      })
      .orderBy('start_date', 'asc')
      .get()
      .then(res => {
        this.setData({
          restTimes: res.data
        });
      })
      .catch(err => {
        console.error('获取休息时间失败:', err);
      });
  },

  // 设置默认日期时间
  setDefaultDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    this.setData({
      startDate: `${year}-${month}-${day}`,
      startTime: `${hours}:${minutes}`
    });
  },

  // 选择休息选项
  selectRestOption(e) {
    this.setData({
      selectedOption: parseInt(e.currentTarget.dataset.value)
    });
  },

  // 日期选择器变化
  bindDateChange(e) {
    this.setData({
      startDate: e.detail.value
    });
  },

  // 时间选择器变化
  bindTimeChange(e) {
    this.setData({
      startTime: e.detail.value
    });
  },

  // 计算结束时间
  calculateEndDateTime() {
    const { startDate, startTime, selectedOption } = this.data;
    
    // 将开始日期和时间合并成一个完整的日期时间对象
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    
    // 计算结束日期时间（开始时间 + 所选小时数）
    const endDateTime = new Date(startDateTime.getTime() + selectedOption * 60 * 60 * 1000);
    
    // 格式化结束日期和时间
    const year = endDateTime.getFullYear();
    const month = String(endDateTime.getMonth() + 1).padStart(2, '0');
    const day = String(endDateTime.getDate()).padStart(2, '0');
    const hours = String(endDateTime.getHours()).padStart(2, '0');
    const minutes = String(endDateTime.getMinutes()).padStart(2, '0');
    const seconds = String(endDateTime.getSeconds()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}:${seconds}`,
      full: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
      iso: endDateTime.toISOString()
    };
  },

  // 确认设置休息时间
  confirmRestTime() {
    const { staffInfo, startDate, startTime, selectedOption } = this.data;
    
    if (!startDate || !startTime) {
      wx.showToast({
        title: '请选择开始时间',
        icon: 'none'
      });
      return;
    }

    // 检查员工信息
    if (!staffInfo || !staffInfo._id) {
      wx.showToast({
        title: '员工信息不完整',
        icon: 'none'
      });
      return;
    }

    // 计算结束时间
    const endDateTime = this.calculateEndDateTime();
    
    // 确认提示
    wx.showModal({
      title: '确认设置休息时间',
      content: `从 ${startDate} ${startTime} 开始休息 ${this.getOptionLabel(selectedOption)}，到 ${endDateTime.date} ${endDateTime.time} 结束`,
      success: (res) => {
        if (res.confirm) {
          this.saveRestTime(endDateTime.full, endDateTime.iso);
        }
      }
    });
  },

  // 获取选项标签
  getOptionLabel(value) {
    const option = this.data.restOptions.find(item => item.value === value);
    return option ? option.label : '';
  },

  // 保存休息时间
  saveRestTime(endDateTimeStr, endDateTimeIso) {
    const { staffInfo, startDate, startTime } = this.data;
    
    const startDateTimeIso = new Date(`${startDate}T${startTime}:00`).toISOString();
    
    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    const db = wx.cloud.database();
    
    // 创建休息时间记录
    db.collection('rest_times').add({
      data: {
        therapist_id: staffInfo._id || '',
        therapist_name: staffInfo.name || '',
        start_date: startDateTimeIso,
        end_date: endDateTimeIso,
        start_date_display: `${startDate} ${startTime}:00`,
        end_date_display: endDateTimeStr,
        reason: '员工设置休息时间',
        status: 'active',
        create_time: db.serverDate(),
        update_time: db.serverDate()
      }
    })
    .then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '设置成功',
        icon: 'success'
      });
      
      // 重新加载休息时间列表
      this.loadRestTimes();
    })
    .catch(err => {
      wx.hideLoading();
      console.error('设置休息时间失败:', err);
      wx.showToast({
        title: '设置失败',
        icon: 'none'
      });
    });
  },

  // 取消设置的休息时间
  cancelRestTime(e) {
    const restTimeId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '取消休息时间',
      content: '确定要取消这个休息时间吗？',
      success: (res) => {
        if (res.confirm) {
          const db = wx.cloud.database();
          
          wx.showLoading({
            title: '取消中...',
            mask: true
          });
          
          db.collection('rest_times')
            .doc(restTimeId)
            .update({
              data: {
                status: 'cancelled',
                update_time: db.serverDate()
              }
            })
            .then(() => {
              wx.hideLoading();
              wx.showToast({
                title: '取消成功',
                icon: 'success'
              });
              
              // 重新加载休息时间列表
              this.loadRestTimes();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('取消休息时间失败:', err);
              wx.showToast({
                title: '取消失败',
                icon: 'none'
              });
            });
        }
      }
    });
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack();
  }
}) 