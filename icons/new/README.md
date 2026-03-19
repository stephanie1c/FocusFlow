# FocusFlow Icons

FocusFlow Chrome 扩展的自定义图标集，采用统一的 Clean 风格设计，支持深色/浅色主题。

## 设计规范

| 属性 | 值 |
|------|-----|
| **风格** | Clean (现代精致) |
| **网格** | 24px |
| **线宽** | 1.5px |
| **线帽** | round |
| **连接** | round |
| **圆角** | 2px |
| **边距** | 2px |

## 图标列表 (20个)

### 品牌与核心
- `logo` - FocusFlow 主 Logo（番茄钟）
- `timer` - 计时器/番茄钟
- `time` - 时间/时钟
- `focus` - 专注模式

### 计时器控制
- `play` - 开始计时
- `pause` - 暂停计时
- `reset` - 重置计时
- `check` - 完成/确认

### 统计与数据
- `chart-bar` - 柱状图
- `chart-pie` - 饼图
- `calendar` - 日历
- `website` - 网站/地球

### 界面操作
- `settings` - 设置
- `menu` - 菜单
- `close` - 关闭
- `plus` - 添加
- `minus` - 减少
- `edit` - 编辑
- `delete` - 删除
- `arrow-left` - 左箭头
- `arrow-right` - 右箭头

## 主题支持

### 浅色模式
```css
color: #1a1a2e;
background: #ffffff;
```

### 深色模式
```css
color: #f0f0f5;
background: #0a0a0f;
```

## 使用方法

### 在 HTML 中直接使用
```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
  <!-- 图标路径 -->
</svg>
```

### 在 CSS 中控制颜色
```css
.icon {
  color: #f0f0f5; /* 根据主题调整 */
}
```

### Chrome 扩展图标
扩展图标使用珊瑚橙渐变背景：
```css
background: linear-gradient(135deg, #ff6b4a 0%, #ff8f70 100%);
```

## 预览

打开 `preview.html` 查看所有图标的深色/浅色模式效果。

## 文件结构

```
icons/new/
├── logo.svg
├── timer.svg
├── play.svg
├── pause.svg
├── ... (20个SVG文件)
├── style-spec.json    # 样式规范
├── preview.html       # 预览页面
└── README.md          # 本文件
```

## 版本

v1.0.0 - 2026-03-19
