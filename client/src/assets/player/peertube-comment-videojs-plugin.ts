import videojs from 'video.js'

// videojs typings don't have some method we need
const videojsUntyped = videojs as any

const component = new (videojsUntyped.getComponent('Component'))(this)

type Comment = {
  color: string
  position: number
  text: string
  time: number
}

type PeertubeCommentPluginOptions = {
  comments: Comment[]
  width: string
  height: string
}

const peertubeCommentPlugin = function({comments, width, height}: PeertubeCommentPluginOptions) {
  const container = document.createElement('div')
  let pendingComments = comments
  let shownComments = []

  component.el().appendChild(container)
  component.addClass('vjs-peertube-comment-container')
  this.addChild(component, {}, 1)

  this.on('loadedmetadata', () => container.style.setProperty(width,
          `calc(var(${height}) * ${this.videoWidth() / this.videoHeight()})`))

  this.on('timeupdate', ({target}) => {
    const currentTime = target.player.currentTime()

    shownComments = shownComments.filter(({element, time}) => {
      if (time > currentTime) {
        return true
      }

      container.removeChild(element)
      return false
    })

    pendingComments = pendingComments.filter(({color, position, size, text, time}) => {
      if (time > currentTime) {
        return true
      }

      const element = document.createElement('p')

      switch (position) {
      case 'auto':
        element.className = 'vjs-peertube-comment-auto'
        element.style.top = `calc((var(${height}) * ${1 - size}) * ${Math.random()})`
        break

      case 'bottom':
        element.style.top = `calc(var(${height}) * ${1 - size})`
      case 'top':
        element.className = 'vjs-peertube-comment-center'
        break
      }

      element.style.color = color
      element.style.fontSize = `calc(var(${height}) * ${size})`
      element.textContent = text

      container.appendChild(element)
      shownComments.push({element, time: time + 9})

      return false
    })
  })

  this.on('pause', () => shownComments.forEach(({element}) =>
    element.style.animationPlayState = 'paused'))

  this.on('playing', () => shownComments.forEach(({element}) =>
    element.style.animationPlayState = 'running'))

  this.on('seeked', ({target}) => {
    const currentTime = target.player.currentTime()

    while (container.lastChild) {
      container.removeChild(container.lastChild)
    }

    pendingComments = comments.filter(({time}) => time > currentTime)
    shownComments = []
  })
}

videojsUntyped.registerPlugin('peertubeComment', peertubeCommentPlugin)
