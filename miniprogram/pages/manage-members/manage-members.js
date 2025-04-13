Page({
  data: {
    searchInput: '', // 更改为通用搜索输入
    searchType: 'phone', // 'phone' 或 'name'
    userInfo: null,
    loading: false,
    recentMembers: [], // 最近操作的会员
    userAppointments: [], // 用户预约记录
    showAppointments: false, // 是否显示预约列表
    showTimeChangeModal: false, // 是否显示修改时间弹窗
    selectedAppointment: null, // 当前选中的预约
    availableTimes: [], // 可用时间列表
    selectedDate: '', // 选择的新日期
    selectedTime: '', // 选择的新时间
    dateOptions: [], // 可选日期列表
    showServiceTimes: false, // 是否显示服务次数详情
    totalRemainingTimes: 0, // 总剩余次数
  },

  onLoad() {
    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 检查员工权限
    const staffInfo = wx.getStorageSync('staffInfo');
    if (!staffInfo || !staffInfo._id) {
      wx.showModal({
        title: '权限不足',
        content: '您没有权限访问此页面，请使用员工账号登录',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }
    
    // 加载最近操作的会员
    this.loadRecentMembers();
    // 初始化日期选项，未来7天
    this.initDateOptions();
  },

  // 监听用户数据变化
  watchUserData(userId) {
    if (!userId) return;
    
    // 如果已有监听器，先取消
    if (this.userWatcher) {
      this.userWatcher.close();
    }
    
    // 建立新的监听器
    const db = wx.cloud.database();
    this.userWatcher = db.collection('users')
      .doc(userId)
      .watch({
        onChange: snapshot => {
          // 获取变动后的数据
          const userData = snapshot.docs[0];
          if (userData && userData.service_times) {
            // 重新计算总次数
            const totalRemainingTimes = this.calculateTotalTimes(userData.service_times);
            
            // 更新用户信息和总次数
            this.setData({
              userInfo: userData,
              totalRemainingTimes
            });
            
            console.log('用户数据已更新，总剩余次数:', totalRemainingTimes);
          }
        },
        onError: err => {
          console.error('监听用户数据失败:', err);
        }
      });
  },

  // 从其他页面返回时，刷新当前用户数据
  onShow() {
    // 如果有当前选中的用户，重新加载该用户的信息
    if (this.data.userInfo && this.data.userInfo._id) {
      this.refreshUserInfo(this.data.userInfo._id);
      // 监听用户数据变化
      this.watchUserData(this.data.userInfo._id);
    }
  },
  
  // 刷新用户信息
  refreshUserInfo(userId) {
    const db = wx.cloud.database();
    
    db.collection('users')
      .doc(userId)
      .get()
      .then(res => {
        // 确保service_times字段初始化
        const userInfo = res.data;
        if (!userInfo.service_times) {
          // 使用云函数初始化service_times字段
          wx.cloud.callFunction({
            name: 'initServiceTimes',
            data: {
              userId: userInfo._id
            }
          }).then(() => {
            console.log('service_times初始化成功');
          }).catch(err => {
            console.error('初始化service_times失败:', err);
          });
          
          userInfo.service_times = {
            basic_60: 0,
            basic_90: 0,
            advanced_60: 0,
            advanced_90: 0
          };
        }
        
        // 计算总次数
        const totalRemainingTimes = this.calculateTotalTimes(userInfo.service_times);
        
        // 更新用户信息
        this.setData({ 
          userInfo,
          totalRemainingTimes 
        });
        console.log('用户信息已刷新，总剩余次数:', totalRemainingTimes);
      })
      .catch(err => {
        console.error('刷新用户信息失败:', err);
      });
  },

  // 计算总剩余次数
  calculateTotalTimes(serviceTimes) {
    if (!serviceTimes) return 0;
    
    // 计算所有服务项目的次数总和
    const total = (
      (serviceTimes.basic_60 || 0) + 
      (serviceTimes.basic_90 || 0) + 
      (serviceTimes.advanced_60 || 0) + 
      (serviceTimes.advanced_90 || 0)
    );
    
    return total;
  },

  // 初始化日期选项
  initDateOptions() {
    const dateOptions = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
      
      dateOptions.push({
        date: dateStr,
        display: i === 0 ? '今天' : (i === 1 ? '明天' : `${month}-${day} ${dayOfWeek}`)
      });
    }
    
    this.setData({ 
      dateOptions,
      selectedDate: dateOptions[0].date
    });
  },

  // 加载最近操作的会员
  loadRecentMembers() {
    const db = wx.cloud.database();
    const _ = db.command;
    
    db.collection('users')
      .where(_.or([
        { role: _.neq('staff') },
        { role: _.exists(false) }
      ]))
      .orderBy('update_time', 'desc')
      .limit(5)
      .get()
      .then(res => {
        this.setData({
          recentMembers: res.data
        });
      })
      .catch(err => {
        console.error('获取最近会员失败:', err);
      });
  },

  // 输入搜索内容
  handleSearchInput(e) {
    this.setData({
      searchInput: e.detail.value
    });
  },

  // 切换搜索类型
  switchSearchType() {
    this.setData({
      searchType: this.data.searchType === 'phone' ? 'name' : 'phone'
    });
  },

  // 搜索会员
  searchMember() {
    const { searchInput, searchType } = this.data;
    
    if (!searchInput) {
      wx.showToast({
        title: '请输入搜索内容',
        icon: 'none'
      });
      return;
    }

    if (searchType === 'phone' && (!/^\d{11}$/.test(searchInput))) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 构建查询条件 - 排除员工账号，同时考虑没有role字段的记录
    let baseCondition = _.or([
      { role: _.neq('staff') },
      { role: _.exists(false) }
    ]);
    
    let searchCondition;
    if (searchType === 'phone') {
      searchCondition = { phone: searchInput };
    } else {
      // 优化搜索策略，使用前缀匹配提高索引效率，并避免忽略大小写选项
      // 创建多个条件，分别匹配原始、全大写和全小写版本的名称
      const lowerCaseInput = searchInput.toLowerCase();
      const upperCaseInput = searchInput.toUpperCase();
      
      searchCondition = _.or([
        // 使用前缀匹配 - 开头匹配，能使用索引
        { nickName: db.RegExp({ regexp: `^${searchInput}` }) },
        { nickName: db.RegExp({ regexp: `^${lowerCaseInput}` }) },
        { nickName: db.RegExp({ regexp: `^${upperCaseInput}` }) },
        // 增加包含搜索，但不使用忽略大小写选项
        { nickName: db.RegExp({ regexp: searchInput }) },
        { nickName: db.RegExp({ regexp: lowerCaseInput }) },
        { nickName: db.RegExp({ regexp: upperCaseInput }) }
      ]);
    }
    
    // 合并两个条件
    db.collection('users')
      .where(_.and([baseCondition, searchCondition]))
      .get()
      .then(res => {
        if (res.data.length === 0) {
          wx.showToast({
            title: '未找到该会员',
            icon: 'none'
          });
          this.setData({
            userInfo: null,
            loading: false,
            userAppointments: [],
            showAppointments: false
          });
        } else {
          // 确保service_times字段初始化
          const userInfo = res.data[0];
          if (!userInfo.service_times) {
            userInfo.service_times = {
              basic_60: 0,
              basic_90: 0,
              advanced_60: 0,
              advanced_90: 0
            };
            
            // 使用云函数初始化service_times字段
            wx.cloud.callFunction({
              name: 'initServiceTimes',
              data: {
                userId: userInfo._id
              }
            }).then(() => {
              console.log('service_times初始化成功');
            }).catch(err => {
              console.error('初始化service_times失败:', err);
            });
          }
          
          // 计算总次数
          const totalRemainingTimes = this.calculateTotalTimes(userInfo.service_times);
          
          this.setData({
            userInfo: userInfo,
            loading: false,
            totalRemainingTimes
          });
          
          // 监听用户数据变化
          this.watchUserData(userInfo._id);
          
          // 找到会员后查询其预约记录
          this.loadUserAppointmentsByOpenid(userInfo._openid);
        }
      })
      .catch(err => {
        console.error('查询会员失败:', err);
        wx.showToast({
          title: '查询失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },

  // 加载用户预约记录
  loadUserAppointments(openid) {
    if (!openid) {
      wx.hideLoading();
      return;
    }
    
    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 修改查询条件，查询所有预约而不限制日期和状态
    db.collection('appointments')
      .where({
        _openid: openid
      })
      .orderBy('appointment_date', 'desc') // 按日期降序排列，最新的预约排在前面
      .orderBy('time_slot', 'asc')
      .get()
      .then(res => {
        console.log('获取到的预约数据:', res.data);
        
        // 检查获取到的数据
        if (res.data.length === 0) {
          this.setData({
            userAppointments: [],
            showAppointments: false,
            loading: false
          });
          
          wx.hideLoading();
          wx.showToast({
            title: '该会员暂无预约记录',
            icon: 'none'
          });
          return;
        }
        
        const appointments = res.data.map(item => ({
          _id: item._id,
          serviceName: item.service_name,
          date: item.appointment_date,
          timeSlot: item.time_slot,
          status: this.formatStatus(item.status),
          price: item.price,
          rawStatus: item.status
        }));
        
        this.setData({
          userAppointments: appointments,
          showAppointments: appointments.length > 0,
          loading: false
        });
        
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取预约记录失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '获取预约失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },
  
  // 查看预约详情
  viewAppointmentDetails(e) {
    const appointmentId = e.currentTarget.dataset.id;
    const appointment = this.data.userAppointments.find(item => item._id === appointmentId);
    
    if (!appointment) return;
    
    // 构建详情文本
    let detailText = `服务: ${appointment.serviceName}\n`;
    detailText += `日期: ${appointment.date}\n`;
    detailText += `时间: ${appointment.timeSlot}\n`;
    detailText += `状态: ${appointment.status}\n`;
    detailText += `价格: ¥${appointment.price}`;
    
    wx.showModal({
      title: '预约详情',
      content: detailText,
      showCancel: false,
      confirmText: '确定'
    });
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

  // 选择最近会员
  selectRecentMember(e) {
    const memberId = e.currentTarget.dataset.id;
    const member = this.data.recentMembers.find(item => item._id === memberId);
    
    if (member) {
      // 确保service_times字段初始化
      if (!member.service_times) {
        member.service_times = {
          basic_60: 0,
          basic_90: 0,
          advanced_60: 0,
          advanced_90: 0
        };
        
        // 使用云函数初始化service_times字段
        wx.cloud.callFunction({
          name: 'initServiceTimes',
          data: {
            userId: member._id
          }
        }).then(() => {
          console.log('service_times初始化成功');
        }).catch(err => {
          console.error('初始化service_times失败:', err);
        });
      }
      
      // 计算总次数
      const totalRemainingTimes = this.calculateTotalTimes(member.service_times);
      
      this.setData({
        userInfo: member,
        searchInput: member.phone || '',
        totalRemainingTimes
      });
      
      // 监听用户数据变化
      this.watchUserData(member._id);
      
      // 加载该会员的预约记录
      this.loadUserAppointmentsByOpenid(member._openid);
    }
  },

  // 赠送次数
  giftTimes() {
    const { userInfo } = this.data;
    if (!userInfo) {
      wx.showToast({
        title: '请先选择会员',
        icon: 'none'
      });
      return;
    }

    const staffInfo = wx.getStorageSync('staffInfo');
    
    // 检查员工信息
    if (!staffInfo || !staffInfo._id) {
      wx.showToast({
        title: '员工信息不完整',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到赠送服务页面
    wx.navigateTo({
      url: `/pages/gift-service/gift-service?userId=${userInfo._id}&phone=${userInfo.phone || ''}`
    });
  },

  // 查看预约
  viewUserAppointments() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先查找会员',
        icon: 'none'
      });
      return;
    }
    
    // 重新加载预约记录
    wx.showLoading({
      title: '加载预约中...',
      mask: true
    });
    
    // 先确保显示预约区域
    this.setData({
      showAppointments: true
    });
    
    // 重新加载预约数据
    if (this.data.userInfo._openid) {
      this.loadUserAppointmentsByOpenid(this.data.userInfo._openid);
    } else if (this.data.userInfo.phone) {
      this.loadUserAppointmentsByPhone(this.data.userInfo.phone);
    } else {
      // 通过_id再次查询用户信息，获取更多详情
      const db = wx.cloud.database();
      db.collection('users')
        .doc(this.data.userInfo._id)
        .get()
        .then(res => {
          if (res.data && res.data._openid) {
            this.loadUserAppointmentsByOpenid(res.data._openid);
          } else if (res.data && res.data.phone) {
            this.loadUserAppointmentsByPhone(res.data.phone);
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '无法获取用户预约信息',
              icon: 'none'
            });
          }
        })
        .catch(err => {
          console.error('获取用户信息失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        });
    }
  },

  // 编辑会员信息
  editMemberInfo() {
    const { userInfo } = this.data;
    if (!userInfo) {
      wx.showToast({
        title: '请先选择会员',
        icon: 'none'
      });
      return;
    }

    const staffInfo = wx.getStorageSync('staffInfo');
    
    // 检查员工信息
    if (!staffInfo || !staffInfo._id) {
      wx.showToast({
        title: '员工信息不完整',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到编辑会员页面
    wx.navigateTo({
      url: `/pages/edit-member/edit-member?userId=${userInfo._id}`
    });
  },
  
  // 取消预约
  cancelAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;
    const appointment = this.data.userAppointments.find(item => item._id === appointmentId);
    
    if (!appointment) return;
    
    wx.showModal({
      title: '确认取消',
      content: `确定要取消"${appointment.serviceName}"的预约吗？`,
      success: res => {
        if (res.confirm) {
          this.doCancelAppointment(appointmentId);
        }
      }
    });
  },
  
  // 执行取消预约
  doCancelAppointment(appointmentId) {
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
    
    // 使用云函数取消预约
    wx.cloud.callFunction({
      name: 'cancelOrder',
      data: {
        appointmentId: appointmentId,
        staffInfo: {
          _id: staffInfo._id,
          name: staffInfo.name || '员工'
        },
        reason: '员工代客户取消'
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '取消成功',
          icon: 'success'
        });
        
        // 更新本地数据
        const userAppointments = this.data.userAppointments.map(item => {
          if (item._id === appointmentId) {
            return {
              ...item,
              status: '已取消',
              rawStatus: 'cancelled'
            };
          }
          return item;
        }).filter(item => item.rawStatus !== 'cancelled'); // 可选：从列表中移除已取消的预约
        
        this.setData({
          userAppointments,
          showAppointments: userAppointments.length > 0
        });
      } else {
        wx.showToast({
          title: res.result && res.result.message ? res.result.message : '取消失败',
          icon: 'none'
        });
      }
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
  
  // 显示修改时间弹窗
  showChangeTimeModal(e) {
    const appointmentId = e.currentTarget.dataset.id;
    const appointment = this.data.userAppointments.find(item => item._id === appointmentId);
    
    if (!appointment) return;
    
    this.setData({
      selectedAppointment: appointment,
      showTimeChangeModal: true,
      selectedDate: appointment.date, // 默认选择当前预约日期
    });
    
    // 加载该日期可用的时间段
    this.loadAvailableTimes(appointment.date);
  },
  
  // 加载可用时间段
  loadAvailableTimes(date) {
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 所有时间段
    const allTimeSlots = [];
    for (let hour = 10; hour < 22; hour++) {
      allTimeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      allTimeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    // 查询已预约的时间段
    db.collection('appointments')
      .where({
        appointment_date: date,
        status: _.in(['pending', 'confirmed']),
        _id: _.neq(this.data.selectedAppointment._id) // 排除当前预约
      })
      .field({ time_slot: true })
      .get()
      .then(res => {
        // 获取已预约的时间段
        const bookedTimeSlots = res.data.map(item => item.time_slot);
        
        // 过滤出可用时间段 - 替换includes为indexOf
        const availableTimes = allTimeSlots.filter(time => {
          return bookedTimeSlots.indexOf(time) === -1; // 不在已预约列表中的时间段
        });
        
        this.setData({ availableTimes });
      })
      .catch(err => {
        console.error('获取可用时间失败:', err);
        this.setData({ availableTimes: allTimeSlots }); // 出错时显示所有时间
      });
  },
  
  // 选择日期
  onDateChange(e) {
    const selectedDate = this.data.dateOptions[e.detail.value].date;
    this.setData({ selectedDate });
    // 加载该日期可用的时间段
    this.loadAvailableTimes(selectedDate);
  },
  
  // 选择时间
  selectTime(e) {
    this.setData({
      selectedTime: e.currentTarget.dataset.time
    });
  },
  
  // 关闭修改时间弹窗
  closeTimeModal() {
    this.setData({
      showTimeChangeModal: false,
      selectedAppointment: null,
      selectedTime: ''
    });
  },
  
  // 确认修改时间
  confirmTimeChange() {
    const { selectedDate, selectedTime, selectedAppointment } = this.data;
    
    if (!selectedTime) {
      wx.showToast({
        title: '请选择时间',
        icon: 'none'
      });
      return;
    }
    
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
      title: '修改中...',
      mask: true
    });
    
    // 使用云函数修改预约时间
    wx.cloud.callFunction({
      name: 'updateAppointmentTime',
      data: {
        appointmentId: selectedAppointment._id,
        newDate: selectedDate,
        newTime: selectedTime,
        staffInfo: {
          _id: staffInfo._id,
          name: staffInfo.name || '员工'
        }
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        });
        
        // 更新本地数据
        const userAppointments = this.data.userAppointments.map(item => {
          if (item._id === selectedAppointment._id) {
            return {
              ...item,
              date: selectedDate,
              timeSlot: selectedTime
            };
          }
          return item;
        });
        
        this.setData({
          userAppointments,
          showTimeChangeModal: false,
          selectedAppointment: null,
          selectedTime: ''
        });
      } else {
        wx.showToast({
          title: res.result && res.result.message ? res.result.message : '修改失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('修改时间失败:', err);
      wx.showToast({
        title: '修改失败',
        icon: 'none'
      });
    });
  },

  // 切换显示服务次数详情
  toggleServiceTimes() {
    this.setData({
      showServiceTimes: !this.data.showServiceTimes
    });
  },

  // 加载用户信息
  loadUserInfo(userId) {
    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    
    db.collection('users')
      .doc(userId)
      .get()
      .then(res => {
        const userInfo = res.data;
        
        // 检查和初始化service_times字段
        if (!userInfo.service_times) {
          // 使用云函数初始化service_times字段
          wx.cloud.callFunction({
            name: 'initServiceTimes',
            data: {
              userId: userInfo._id
            }
          }).then(() => {
            console.log('service_times初始化成功');
          }).catch(err => {
            console.error('初始化service_times失败:', err);
          });
          
          userInfo.service_times = {
            basic_60: 0,
            basic_90: 0,
            advanced_60: 0,
            advanced_90: 0
          };
        }
        
        this.setData({
          userInfo,
          showAppointments: false, // 重置预约显示状态
          loading: false
        });
      })
      .catch(err => {
        console.error('获取会员信息失败:', err);
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },

  // 更新会员信息
  updateMemberInfo(userId, newInfo) {
    return new Promise((resolve, reject) => {
      const staffInfo = wx.getStorageSync('staffInfo');
      
      if (!staffInfo || !staffInfo._id) {
        reject(new Error('未找到员工信息'));
        return;
      }
      
      // 确保service_times字段正确初始化
      if (!newInfo.service_times) {
        newInfo.service_times = {
          basic_60: 0,
          basic_90: 0, 
          advanced_60: 0,
          advanced_90: 0
        };
      }
      
      wx.cloud.callFunction({
        name: 'updateMemberInfo',
        data: {
          userId: userId,
          newInfo: newInfo,
          staffInfo: {
            _id: staffInfo._id,
            name: staffInfo.name || '员工'
          }
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          resolve(res.result);
        } else {
          reject(new Error(res.result && res.result.message ? res.result.message : '更新失败'));
        }
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  // 通过手机号加载用户预约
  loadUserAppointmentsByPhone(phone) {
    if (!phone) {
      wx.hideLoading();
      return;
    }
    
    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    
    db.collection('appointments')
      .where({
        user_phone: phone  // 假设预约中有user_phone字段
      })
      .orderBy('appointment_date', 'desc')
      .orderBy('time_slot', 'asc')
      .get()
      .then(res => {
        console.log('通过手机号获取到的预约数据:', res.data);
        
        // 检查获取到的数据
        if (res.data.length === 0) {
          this.setData({
            userAppointments: [],
            showAppointments: false,
            loading: false
          });
          
          wx.hideLoading();
          wx.showToast({
            title: '该会员暂无预约记录',
            icon: 'none'
          });
          return;
        }
        
        const appointments = res.data.map(item => ({
          _id: item._id,
          serviceName: item.service_name,
          date: item.appointment_date,
          timeSlot: item.time_slot,
          status: this.formatStatus(item.status),
          price: item.price,
          rawStatus: item.status
        }));
        
        this.setData({
          userAppointments: appointments,
          showAppointments: appointments.length > 0,
          loading: false
        });
        
        wx.hideLoading();
      })
      .catch(err => {
        console.error('通过手机号获取预约记录失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '获取预约失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },

  // 通过openid加载用户预约
  loadUserAppointmentsByOpenid(openid) {
    if (!openid) {
      wx.hideLoading();
      return;
    }
    
    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 修改查询条件，查询所有预约而不限制日期和状态
    db.collection('appointments')
      .where({
        _openid: openid
      })
      .orderBy('appointment_date', 'desc') // 按日期降序排列，最新的预约排在前面
      .orderBy('time_slot', 'asc')
      .get()
      .then(res => {
        console.log('获取到的预约数据:', res.data);
        
        // 检查获取到的数据
        if (res.data.length === 0) {
          this.setData({
            userAppointments: [],
            showAppointments: false,
            loading: false
          });
          
          wx.hideLoading();
          wx.showToast({
            title: '该会员暂无预约记录',
            icon: 'none'
          });
          return;
        }
        
        const appointments = res.data.map(item => ({
          _id: item._id,
          serviceName: item.service_name,
          date: item.appointment_date,
          timeSlot: item.time_slot,
          status: this.formatStatus(item.status),
          price: item.price,
          rawStatus: item.status
        }));
        
        this.setData({
          userAppointments: appointments,
          showAppointments: appointments.length > 0,
          loading: false
        });
        
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取预约记录失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '获取预约失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },

  // 页面卸载时取消监听
  onUnload() {
    // 取消数据监听
    if (this.userWatcher) {
      this.userWatcher.close();
      this.userWatcher = null;
    }
  },
});
