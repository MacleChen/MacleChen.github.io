// =====================================================
// 博客文章数据
// 新增博文：在 POSTS 数组中添加新对象即可
// content 字段支持 Markdown 格式
// =====================================================

const POSTS = [
  {
    id: "ios-avfoundation-guide",
    title: "iOS音视频开发实战：H264编码与传输优化",
    titleEn: "iOS Audio/Video Deep Dive: H264 Encoding & Zero-Copy Transmission",
    date: "2025-03-01",
    category: "iOS开发",
    categoryEn: "iOS Dev",
    tags: ["iOS", "AVFoundation", "H264", "VideoToolbox"],
    summary: "详解iOS音视频开发核心技术：从ReplayKit捕获屏幕数据，到VideoToolbox H264硬编码，再到YUV格式优化与GCDSocket零拷贝传输，分享将视频帧率从5fps提升至30fps、CPU从90%降至45%的完整实战经验。",
    summaryEn: "A complete walkthrough of iOS audio/video fundamentals: screen capture with ReplayKit, hardware H264 encoding via VideoToolbox, YUV optimization, and zero-copy GCDSocket transfer — lifting frame rate from 5fps to 30fps while cutting CPU from 90% to 45%.",
    cover: "images/project1.jpg",
    content: `# iOS音视频开发实战：H264编码与传输优化

## 背景

在开发 **IdeaHub屏幕共享** 功能时，核心需求是将iPhone/iPad屏幕和声音内容实时传输到华为智慧屏。初始版本存在两个严重问题：

- 视频帧率仅有 **5fps**，播放极其卡顿
- CPU使用率高达 **90%**，设备发烫明显

经过系统性优化，最终将帧率提升至 **30fps**，CPU降低至 **45%**。本文记录完整的技术方案。

## 整体架构

采用 **MVC设计模式** 构建，核心模块如下：

\`\`\`
ReplayKit (数据捕获)
    ↓
VideoToolbox H264 编码器
    ↓
YUV420 → RGB 色域转换
    ↓
GCDSocket + 内存共享传输
    ↓
华为智慧屏解码显示
\`\`\`

音频链路：

\`\`\`
ReplayKit PCM音频
    ↓
WebRTC 音频去噪引擎
    ↓
PCM数据传输
\`\`\`

## H264视频编码

使用 \`VideoToolbox\` 进行硬编码，相比软编码，硬编码可以充分利用GPU，大幅降低CPU占用。

### 创建编码会话

\`\`\`objc
- (void)setupEncoderWithWidth:(int)width height:(int)height {
    NSDictionary *pixelBufferOptions = @{
        (__bridge NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange),
        (__bridge NSString *)kCVPixelBufferWidthKey: @(width),
        (__bridge NSString *)kCVPixelBufferHeightKey: @(height),
    };

    VTCompressionSessionCreate(
        kCFAllocatorDefault, width, height,
        kCMVideoCodecType_H264,
        NULL,
        (__bridge CFDictionaryRef)pixelBufferOptions,
        NULL,
        compressionOutputCallback,
        (__bridge void *)self,
        &_compressionSession
    );

    // 每30帧1个关键帧
    VTSessionSetProperty(_compressionSession,
        kVTCompressionPropertyKey_MaxKeyFrameInterval, (__bridge CFTypeRef)@(30));
    // 目标帧率 30fps
    VTSessionSetProperty(_compressionSession,
        kVTCompressionPropertyKey_ExpectedFrameRate, (__bridge CFTypeRef)@(30));
    // 目标码率 2Mbps
    VTSessionSetProperty(_compressionSession,
        kVTCompressionPropertyKey_AverageBitRate, (__bridge CFTypeRef)@(2000000));

    VTCompressionSessionPrepareToEncodeFrames(_compressionSession);
}
\`\`\`

## 关键优化：内存共享零拷贝传输

**最大的性能提升来自传输层**。原始方案将 CMSampleBuffer 转成 NSData 再传输，涉及大量内存拷贝：

\`\`\`objc
// 低效方案：两次内存拷贝
NSData *frameData = [self dataFromSampleBuffer:sampleBuffer]; // 第一次拷贝
[socket sendData:frameData];                                   // 第二次拷贝
\`\`\`

优化方案：通过 \`CMBlockBufferGetDataPointer\` 直接操作底层内存指针，**零拷贝传输**：

\`\`\`objc
// 高效方案：零拷贝
CMBlockBufferRef blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer);
size_t totalLength = 0;
char *dataPointer = NULL;
CMBlockBufferGetDataPointer(blockBuffer, 0, NULL, &totalLength, &dataPointer);

dispatch_data_t dispatchData = dispatch_data_create(
    dataPointer, totalLength, NULL, DISPATCH_DATA_DESTRUCTOR_DEFAULT);
[socket writeData:(__bridge NSData *)dispatchData withTimeout:-1 tag:0];
\`\`\`

这一改动让CPU直接从 **90% → 45%**。

## WebRTC音频去噪集成

WebRTC音频处理模块提供 AEC回声消除、NS噪声抑制、AGC自动增益三大能力：

\`\`\`objc
RTCAudioSession *audioSession = [RTCAudioSession sharedInstance];
[audioSession lockForConfiguration];
[audioSession setCategory:AVAudioSessionCategoryPlayAndRecord
              withOptions:AVAudioSessionCategoryOptionMixWithOthers
                    error:nil];
[audioSession unlockForConfiguration];
\`\`\`

## 优化效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 视频帧率 | 5 fps | 30 fps |
| CPU 使用率 | ~90% | ~45% |
| 音视频同步 | 不支持 | 支持 |

## 总结

音视频开发的核心在于**减少不必要的数据拷贝**。VideoToolbox硬编码 + 内存共享传输的组合，是iOS高性能视频传输的标准方案。如有问题欢迎在评论区交流。`
  },
  {
    id: "ios-reverse-engineering-frida",
    title: "iOS逆向工程实战：Frida动态插桩从入门到实战",
    titleEn: "iOS Reverse Engineering: Frida Dynamic Instrumentation in Practice",
    date: "2025-02-10",
    category: "逆向开发",
    categoryEn: "Reverse Eng.",
    tags: ["iOS", "逆向工程", "Frida", "动态分析"],
    summary: "Frida是iOS逆向工程中最强大的动态插桩工具之一。本文从环境搭建开始，介绍如何Hook OC方法、拦截网络请求、绕过越狱检测，以及配合Hopper进行静态+动态联合分析的实战经验。",
    summaryEn: "Frida is one of the most powerful dynamic instrumentation tools for iOS RE. This post covers environment setup, hooking Objective-C methods, intercepting network requests, bypassing jailbreak detection, and combining with Hopper for static+dynamic analysis.",
    cover: "images/project2.jpg",
    content: `# iOS逆向工程实战：Frida动态插桩从入门到实战

> **声明**：本文所有技术仅用于安全研究、学习和合法的竞品分析，请勿用于非法目的。

## Frida简介

[Frida](https://frida.re) 是一个跨平台的动态插桩工具，支持 iOS、Android、Windows、macOS 等平台。它允许你在运行时注入JavaScript脚本，Hook任意函数，修改内存数据。

**核心能力：**
- Hook Objective-C / Swift 方法
- Hook C / C++ 函数
- 拦截和修改网络请求
- 读写进程内存

## 环境搭建

### PC端

\`\`\`bash
# 安装frida工具集
pip3 install frida frida-tools

# 验证安装
frida --version
\`\`\`

### iOS设备端（需要越狱）

在 Cydia/Sileo 中添加源 \`https://build.frida.re\`，安装 **Frida** 包。

### 验证连接

\`\`\`bash
# USB连接，列出设备进程
frida-ps -U

# 输出示例：
# PID   Name
# ----  -----------
# 123   SpringBoard
# 456   MobileSafari
\`\`\`

## 基础用法

### Hook Objective-C方法

\`\`\`javascript
// hook_network.js
// 目标：拦截所有NSURLSession网络请求，打印URL

Java.perform(function() {
    var method = ObjC.classes.NSURLSession['- dataTaskWithRequest:completionHandler:'];
    var origImpl = method.implementation;

    method.implementation = ObjC.implement(method, function(self, sel, request, completionHandler) {
        var url = request.URL().absoluteString().toString();
        console.log('[Network] ' + url);
        return origImpl(self, sel, request, completionHandler);
    });
});
\`\`\`

\`\`\`bash
frida -U -n "TargetApp" -l hook_network.js
\`\`\`

### Hook Swift方法

Swift方法名经过混淆，先用 \`frida-trace\` 找真实符号：

\`\`\`bash
frida-trace -U -n "TargetApp" -m "*login*"
\`\`\`

### 读写内存

\`\`\`javascript
// 读取内存
var ptr = ptr('0x12345678');
console.log(hexdump(ptr, { length: 64 }));

// 写入NOP指令（跳过某段逻辑）
Memory.writeByteArray(ptr, [0x90, 0x90]);
\`\`\`

## 实战：绕过越狱检测

常见越狱检测方式及绕过：

\`\`\`javascript
// bypass_jailbreak.js

// 1. 绕过文件系统检测（检查 /Applications/Cydia.app 等路径）
var fileExistsMethod = ObjC.classes.NSFileManager['- fileExistsAtPath:'];
var origFileExists = fileExistsMethod.implementation;

fileExistsMethod.implementation = ObjC.implement(fileExistsMethod, function(self, sel, path) {
    var pathStr = path.toString();
    var jbPaths = ['/Applications/Cydia.app', '/usr/bin/ssh', '/etc/apt', '/bin/bash'];

    for (var i = 0; i < jbPaths.length; i++) {
        if (pathStr.indexOf(jbPaths[i]) !== -1) {
            console.log('[Bypass] Blocked jailbreak check: ' + pathStr);
            return false;
        }
    }
    return origFileExists(self, sel, path);
});

// 2. 绕过 fork() 检测
Interceptor.replace(
    Module.findExportByName('libSystem.B.dylib', 'fork'),
    new NativeCallback(function() { return -1; }, 'int', [])
);
\`\`\`

## 配合Hopper静态分析

Frida的动态分析和Hopper的静态分析是最强搭档：

1. **Hopper** 反汇编 Mach-O 文件，找到关键函数和逻辑
2. **Frida** 在运行时验证分析结果，提取真实数据

\`\`\`javascript
// 根据Hopper找到的偏移量，计算运行时地址
var baseAddr = Module.findBaseAddress('TargetApp');
var funcAddr = baseAddr.add(0x1234);  // Hopper中的偏移量
console.log('Function at: ' + funcAddr);

// 在该地址设置Hook
Interceptor.attach(funcAddr, {
    onEnter: function(args) {
        console.log('Called with args: ' + args[0] + ', ' + args[1]);
    },
    onLeave: function(retval) {
        console.log('Return value: ' + retval);
    }
});
\`\`\`

## 总结

Frida是逆向工程师的瑞士军刀。配合Hopper静态分析，可以高效地分析任何iOS应用的行为。请记住，逆向工程需要遵守相关法律法规，仅用于合法用途。

有任何问题欢迎留言交流！`
  },
  {
    id: "mvvm-conference-app",
    title: "MVVM实战：会议软终端崩溃率从20%降至1%的完整过程",
    titleEn: "MVVM in Production: Reducing Conference App Crash Rate from 20% to Under 1%",
    date: "2025-01-20",
    category: "iOS开发",
    categoryEn: "iOS Dev",
    tags: ["iOS", "MVVM", "架构设计", "崩溃优化", "FMDB"],
    summary: "在移动会议软终端开发中，采用MVVM+业务整合架构，通过自建崩溃捕获框架、Method Swizzling防崩溃保护、FMDB数据持久化以及Instruments内存优化，将崩溃率从20%降至1%以下，内存从300M降至200M。",
    summaryEn: "How we rebuilt a mobile conferencing app with MVVM + business adapter architecture, built a custom crash capture framework, applied Method Swizzling guards, and used Instruments to drive crash rate from 20% to under 1% and memory from 300M to 200M.",
    cover: "images/project2.jpg",
    content: `# MVVM实战：会议软终端崩溃率从20%降至1%的完整过程

## 项目背景

会议软终端支持多人视频会议、单向直播、点对点通话等功能。初版上线后，**崩溃率高达20%**，这对企业软件而言完全不可接受。本文记录从架构重构到崩溃治理的完整过程。

## 架构设计：MVVM + 业务整合层

### 为什么选MVVM

MVC在大型项目中容易导致 "Massive View Controller"，ViewController动辄数千行，难以维护和测试。MVVM通过将业务逻辑抽离到ViewModel，让代码结构更清晰：

\`\`\`
View (ViewController)
    ↕ 双向绑定 (KVO / Combine)
ViewModel (业务逻辑 + 数据处理)
    ↕
Model (FMDB / UserDefault / 网络层)
\`\`\`

### 业务整合层

由于会议SDK需要对接多厂商，在MVVM基础上增加**业务整合层**，统一接口差异：

\`\`\`objc
// 统一会议接口协议
@protocol MeetingManagerProtocol <NSObject>
- (void)joinMeeting:(NSString *)meetingId password:(NSString *)password;
- (void)leaveMeeting;
- (void)muteAudio:(BOOL)mute;
- (void)muteVideo:(BOOL)mute;
@end

// 为每个厂商SDK实现适配器
@interface VendorAAdapter : NSObject <MeetingManagerProtocol>
@end
\`\`\`

## 崩溃分析：找出根因

通过Firebase Crashlytics分析，崩溃主要分三类：

| 类型 | 占比 | 根因 |
|------|------|------|
| Unrecognized Selector | 35% | 野指针 / 消息转发失败 |
| 数组/字典越界 | 30% | 未做边界检查 |
| 内存访问违规 | 25% | 多线程数据竞争 |
| 其他 | 10% | — |

## 防崩溃保护：Method Swizzling

针对最高频的两类崩溃，通过 Method Swizzling 做通用保护：

### Unrecognized Selector 防护

\`\`\`objc
@implementation NSObject (SafeMessage)

+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Method original = class_getInstanceMethod(self, @selector(forwardingTargetForSelector:));
        Method swizzled = class_getInstanceMethod(self, @selector(safe_forwardingTargetForSelector:));
        method_exchangeImplementations(original, swizzled);
    });
}

- (id)safe_forwardingTargetForSelector:(SEL)aSelector {
    id target = [self safe_forwardingTargetForSelector:aSelector];
    if (!target) {
        // 返回空代理对象，吞掉未知消息，防止崩溃
        NSLog(@"[SafeGuard] Unrecognized selector: %@, class: %@",
              NSStringFromSelector(aSelector), NSStringFromClass([self class]));
        return [SafeMessageProxy new];
    }
    return target;
}

@end
\`\`\`

### NSArray 越界防护

\`\`\`objc
@implementation NSArray (SafeAccess)

- (id)safeObjectAtIndex:(NSUInteger)index {
    if (index >= self.count) {
        NSLog(@"[SafeGuard] Array out of bounds: index=%lu, count=%lu", index, self.count);
        return nil;
    }
    return [self objectAtIndex:index];
}

@end
\`\`\`

## 自建崩溃捕获框架

在Crashlytics之外，自建轻量崩溃捕获，支持离线保存和下次启动上报：

\`\`\`objc
+ (void)setup {
    NSSetUncaughtExceptionHandler(&handleUncaughtException);
    signal(SIGABRT, handleSignal);
    signal(SIGILL,  handleSignal);
    signal(SIGSEGV, handleSignal);
    signal(SIGFPE,  handleSignal);
    signal(SIGBUS,  handleSignal);
}

static void handleUncaughtException(NSException *exception) {
    NSDictionary *crashInfo = @{
        @"reason":    exception.reason ?: @"",
        @"stack":     exception.callStackSymbols ?: @[],
        @"date":      [NSDate date].description,
        @"version":   [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @""
    };
    // 写入磁盘，下次启动时通过网络上报
    [CrashStorage saveCrashInfo:crashInfo];
}
\`\`\`

## FMDB数据持久化

会议记录、通讯录缓存等复杂数据使用FMDB（SQLite封装），线程安全写入：

\`\`\`objc
- (void)setupDatabase {
    NSString *dbPath = [NSSearchPathForDirectoriesInDomains(
        NSDocumentDirectory, NSUserDomainMask, YES).firstObject
        stringByAppendingPathComponent:@"meeting.db"];
    _dbQueue = [FMDatabaseQueue databaseQueueWithPath:dbPath];
}

// 线程安全写入
- (void)saveMeetingRecord:(MeetingRecord *)record {
    [_dbQueue inDatabase:^(FMDatabase *db) {
        [db executeUpdate:
            @"INSERT OR REPLACE INTO meetings (id, name, date, duration) VALUES (?, ?, ?, ?)",
            record.meetingId, record.name,
            @(record.date.timeIntervalSince1970), @(record.duration)];
    }];
}
\`\`\`

## 内存优化：300M → 200M

三个关键优化点：

1. **SVC视频流懒加载**：不在屏幕内的视频流暂停解码，只保留元数据
2. **头像缓存限制**：通讯录头像内存缓存上限设为 50 张，超出LRU淘汰
3. **循环引用清除**：Instruments Leaks 工具找出并修复所有循环引用（主要在Block中的 self 强引用）

## 最终效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 崩溃率 | ~20% | <1% |
| 内存占用 | ~300M | ~200M |
| 代码可维护性 | 低 | 显著提升 |

## 总结

崩溃治理的核心是：**建立监控 → 分类分析 → 系统性修复 → 持续观测**。防崩溃保护是兜底手段，根本还是要从代码规范和架构上减少bug产生。

欢迎在评论区分享你的崩溃治理经验！`
  }
];
