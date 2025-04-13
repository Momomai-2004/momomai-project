Page({
  data: {
    statusBarHeight: 0,
    // 轮播图数据
    bannerList: [
      {
        id: 1,
        imageUrl: '/images/banner.png'
      }
    ],
    // 理疗师数据
    therapists: [
      {
        id: 'staff001',
        name: 'A',
        avatar: '/images/memoji-a.png'
      },
      {
        id: 'staff002',
        name: 'B',
        avatar: '/images/memoji-b.png'
      },
      {
        id: 'staff003',
        name: 'C',
        avatar: '/images/memoji-c.png'
      }
    ]
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });

    console.log('页面加载');
    this.loadBannerData();
    this.loadTherapists();
  },

  onShow() {
    // 页面显示时检查并打印登录状态，帮助调试
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    console.log('当前登录状态:', isLoggedIn);
  },

  // 页面下拉刷新
  onPullDownRefresh() {
    Promise.all([
      this.loadBannerData(),
      this.loadTherapists()
    ]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载轮播图数据
  loadBannerData() {
    return new Promise((resolve) => {
      // 这里可以替换为实际的API调用
      // wx.request({
      //   url: 'YOUR_API_URL/banners',
      //   success: (res) => {
      //     if (res.data.success) {
      //       this.setData({
      //         bannerList: res.data.data
      //       });
      //     }
      //   }
      // });
      resolve();
    });
  },

  // 加载理疗师数据
  loadTherapists() {
    const db = wx.cloud.database();
    db.collection('staff')
      .where({
        status: 'active'
      })
      .get()
      .then(res => {
        console.log('获取理疗师成功：', res.data);
        // 更新数据，保持原有的显示格式
        if (res.data && res.data.length > 0) {
          this.setData({
            therapists: res.data.map(item => ({
              id: item._id,
              name: item.name,
              avatar: item.avatar || `/images/memoji-${item.staff_id.toLowerCase()}.png`,
              specialties: item.specialties || [],
              services: item.services || []
            }))
          });
        }
      })
      .catch(err => {
        console.error('获取理疗师失败：', err);
        // 如果获取失败，使用默认数据
        this.setData({
          therapists: [
            { id: 'staff_a', name: 'A', avatar: '/images/memoji-a.png' },
            { id: 'staff_b', name: 'B', avatar: '/images/memoji-b.png' },
            { id: 'staff_c', name: 'C', avatar: '/images/memoji-c.png' }
          ]
        });
      });
  },

  // 检查页面访问权限
  checkPagePermission() {
    const app = getApp();
    if (!app.checkPagePermission('index')) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return false;
    }
    return true;
  },

  // 点击头像跳转到预约页面
  goToBooking(e) {
    const therapistId = e.currentTarget.dataset.id;
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const userInfo = wx.getStorageSync('userInfo');

    if (!isLoggedIn) {
      // 修改这里：跳转到登录选择页面，而不是直接到账号登录页面
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return;
    }

    // 查询理疗师详细信息
    const db = wx.cloud.database();
    wx.showLoading({
      title: '加载中...',
    });
    
    // 从staff集合查询，并将数据保存到therapists集合
    db.collection('staff')
      .doc(therapistId)
      .get()
      .then(res => {
        const therapist = res.data;
        console.log('理疗师详细信息:', therapist);
        
        // 创建或更新therapists集合中的记录
        return db.collection('therapists').where({
          staff_id: therapistId
        }).count().then(countRes => {
          // 将staff数据格式转换为therapists格式
          const therapistData = {
            staff_id: therapist._id,
            name: therapist.name,
            phone: therapist.phone,
            avatar: therapist.avatar,
            introduction: therapist.introduction,
            specialties: therapist.specialties,
            service_types: therapist.services || [],  // 将services映射为service_types
            status: therapist.status,
            create_time: therapist.create_time
          };
          
          if (countRes.total === 0) {
            // 不存在，创建新记录
            return db.collection('therapists').add({
              data: therapistData
            });
          } else {
            // 存在，更新记录
            return db.collection('therapists').where({
              staff_id: therapistId
            }).update({
              data: therapistData
            });
          }
        });
      })
      .then(() => {
        // 同步完成，跳转到预约页面
        wx.navigateTo({
          url: `/pages/booking/booking?therapistId=${therapistId}`
        });
      })
      .catch(err => {
        console.error('获取或同步理疗师详情失败:', err);
        // 失败时仍然跳转，但只传递基本信息
        wx.navigateTo({
          url: `/pages/booking/booking?therapistId=${therapistId}`
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  // 检查时间段是否可用
  checkTimeSlotAvailability(therapistId, date, timeSlot) {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 检查预约记录
      db.collection('appointments')
        .where({
          therapist_id: therapistId,
          appointment_date: new Date(date),
          time_slot: timeSlot,
          status: _.neq('cancelled')
        })
        .count()
        .then(res => {
          // 检查休息时间
          db.collection('rest_times')
            .where({
              therapist_id: therapistId,
              start_date: _.lte(new Date(date)),
              end_date: _.gte(new Date(date)),
              status: 'active'
            })
            .count()
            .then(restRes => {
              // 如果没有预约记录且不在休息时间，则时间段可用
              resolve(res.total === 0 && restRes.total === 0);
            })
            .catch(err => {
              console.error('查询休息时间失败：', err);
              reject(err);
            });
        })
        .catch(err => {
          console.error('查询预约记录失败：', err);
          reject(err);
        });
    });
  },

  // 处理轮播图点击
  handleBannerClick(e) {
    const bannerId = e.currentTarget.dataset.id;
    const banner = this.data.bannerList.find(item => item.id === bannerId);
    
    if (!banner) return;

    // 根据banner类型处理跳转
    switch (banner.linkType) {
      case 'service':
        wx.navigateTo({
          url: `/pages/service/detail?id=${banner.linkData}`
        });
        break;
      
      case 'promotion':
        wx.navigateTo({
          url: `/pages/promotion/detail?id=${banner.linkData}`
        });
        break;
      
      case 'article':
        wx.navigateTo({
          url: `/pages/article/detail?id=${banner.linkData}`
        });
        break;
      
      default:
        console.log('未知的轮播图类型');
    }
  },

  // 错误处理
  handleImageError(e) {
    const type = e.currentTarget.dataset.type;
    const index = e.currentTarget.dataset.index;
    
    if (type === 'banner') {
      // 设置轮播图加载失败默认图
      const defaultImage = '/images/default/banner-default.png';
      const key = `bannerList[${index}].imageUrl`;
      this.setData({
        [key]: defaultImage
      });
    } else if (type === 'avatar') {
      // 设置头像加载失败默认图
      const defaultAvatar = '/images/default/avatar-default.png';
      const key = `therapists[${index}].avatar`;
      this.setData({
        [key]: defaultAvatar
      });
    }
  }
}); 