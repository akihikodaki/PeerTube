import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { MetaService } from '@ngx-meta/core'
import { NotificationsService } from 'angular2-notifications'
import { Observable } from 'rxjs/Observable'
import { Subscription } from 'rxjs/Subscription'
import videojs from 'video.js'
import { UserVideoRateType, VideoRateType } from '../../../../../shared'
import '../../../assets/player/peertube-videojs-plugin'
import '../../../assets/player/peertube-comment-videojs-plugin'
import { AuthService, ConfirmService } from '../../core'
import { VideoBlacklistService } from '../../shared'
import { MarkdownService, VideoDetails, VideoService } from '../shared'
import { VideoDownloadComponent } from './video-download.component'
import { VideoReportComponent } from './video-report.component'
import { VideoShareComponent } from './video-share.component'

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  @ViewChild('videoDownloadModal') videoDownloadModal: VideoDownloadComponent
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent
  @ViewChild('videoReportModal') videoReportModal: VideoReportComponent

  downloadSpeed: number
  error = false
  loading = false
  numPeers: number
  player: videojs.Player
  playerElement: HTMLMediaElement
  uploadSpeed: number
  userRating: UserVideoRateType = null
  video: VideoDetails = null
  videoPlayerLoaded = false
  videoNotFound = false
  descriptionLoading = false

  completeDescriptionShown = false
  completeVideoDescription: string
  shortVideoDescription: string
  videoHTMLDescription = ''

  private paramsSub: Subscription

  constructor (
    private elementRef: ElementRef,
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private videoBlacklistService: VideoBlacklistService,
    private confirmService: ConfirmService,
    private metaService: MetaService,
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private markdownService: MarkdownService
  ) {}

  ngOnInit () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      let uuid = routeParams['uuid']
      this.videoService.getVideo(uuid).subscribe(
        video => this.onVideoFetched(video),

        error => {
          this.videoNotFound = true
          console.error(error)
        }
      )
    })
  }

  ngOnDestroy () {
    // Remove player if it exists
    if (this.videoPlayerLoaded === true) {
      videojs(this.playerElement).dispose()
    }

    // Unsubscribe subscriptions
    this.paramsSub.unsubscribe()
  }

  setLike () {
    if (this.isUserLoggedIn() === false) return
    // Already liked this video
    if (this.userRating === 'like') return

    this.videoService.setVideoLike(this.video.id)
                     .subscribe(
                      () => {
                        // Update the video like attribute
                        this.updateVideoRating(this.userRating, 'like')
                        this.userRating = 'like'
                      },

                      err => this.notificationsService.error('Error', err.message)
                     )
  }

  setDislike () {
    if (this.isUserLoggedIn() === false) return
    // Already disliked this video
    if (this.userRating === 'dislike') return

    this.videoService.setVideoDislike(this.video.id)
                     .subscribe(
                      () => {
                        // Update the video dislike attribute
                        this.updateVideoRating(this.userRating, 'dislike')
                        this.userRating = 'dislike'
                      },

                      err => this.notificationsService.error('Error', err.message)
                     )
  }

  removeVideo (event: Event) {
    event.preventDefault()

    this.confirmService.confirm('Do you really want to delete this video?', 'Delete').subscribe(
      res => {
        if (res === false) return

        this.videoService.removeVideo(this.video.id)
                         .subscribe(
                           status => {
                             this.notificationsService.success('Success', `Video ${this.video.name} deleted.`)
                             // Go back to the video-list.
                             this.router.navigate(['/videos/list'])
                           },

                           error => this.notificationsService.error('Error', error.text)
                          )
      }
    )
  }

  blacklistVideo (event: Event) {
    event.preventDefault()

    this.confirmService.confirm('Do you really want to blacklist this video ?', 'Blacklist').subscribe(
      res => {
        if (res === false) return

        this.videoBlacklistService.blacklistVideo(this.video.id)
                                  .subscribe(
                                    status => {
                                      this.notificationsService.success('Success', `Video ${this.video.name} had been blacklisted.`)
                                      this.router.navigate(['/videos/list'])
                                    },

                                    error => this.notificationsService.error('Error', error.text)
                                  )
      }
    )
  }

  showMoreDescription () {
    if (this.completeVideoDescription === undefined) {
      return this.loadCompleteDescription()
    }

    this.updateVideoDescription(this.completeVideoDescription)
    this.completeDescriptionShown = true
  }

  showLessDescription () {

    this.updateVideoDescription(this.shortVideoDescription)
    this.completeDescriptionShown = false
  }

  loadCompleteDescription () {
    this.descriptionLoading = true

    this.videoService.loadCompleteDescription(this.video.descriptionPath)
      .subscribe(
        description => {
          this.completeDescriptionShown = true
          this.descriptionLoading = false

          this.shortVideoDescription = this.video.description
          this.completeVideoDescription = description

          this.updateVideoDescription(this.completeVideoDescription)
        },

        error => {
          this.descriptionLoading = false
          this.notificationsService.error('Error', error.text)
        }
      )
  }

  showReportModal (event: Event) {
    event.preventDefault()
    this.videoReportModal.show()
  }

  showShareModal () {
    this.videoShareModal.show()
  }

  showDownloadModal (event: Event) {
    event.preventDefault()
    this.videoDownloadModal.show()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  canUserUpdateVideo () {
    return this.video.isUpdatableBy(this.authService.getUser())
  }

  isVideoRemovable () {
    return this.video.isRemovableBy(this.authService.getUser())
  }

  isVideoBlacklistable () {
    return this.video.isBlackistableBy(this.authService.getUser())
  }

  private updateVideoDescription (description: string) {
    this.video.description = description
    this.setVideoDescriptionHTML()
  }

  private setVideoDescriptionHTML () {
    this.videoHTMLDescription = this.markdownService.markdownToHTML(this.video.description)
  }

  private handleError (err: any) {
    const errorMessage: string = typeof err === 'string' ? err : err.message
    let message = ''

    if (errorMessage.indexOf('http error') !== -1) {
      message = 'Cannot fetch video from server, maybe down.'
    } else {
      message = errorMessage
    }

    this.notificationsService.error('Error', message)
  }

  private checkUserRating () {
    // Unlogged users do not have ratings
    if (this.isUserLoggedIn() === false) return

    this.videoService.getUserVideoRating(this.video.id)
                     .subscribe(
                       ratingObject => {
                         if (ratingObject) {
                           this.userRating = ratingObject.rating
                         }
                       },

                       err => this.notificationsService.error('Error', err.message)
                      )
  }

  private onVideoFetched (video: VideoDetails) {
    this.video = video

    let observable
    if (this.video.isVideoNSFWForUser(this.authService.getUser())) {
      observable = this.confirmService.confirm(
        'This video contains mature or explicit content. Are you sure you want to watch it?',
        'Mature or explicit content'
      )
    } else {
      observable = Observable.of(true)
    }

    observable.subscribe(
      res => {
        if (res === false) {

          return this.router.navigate([ '/videos/list' ])
        }

        this.playerElement = this.elementRef.nativeElement.querySelector('#video-container')

        const videojsOptions = {
          controls: true,
          autoplay: true,
          plugins: {
            peertube: {
              videoFiles: this.video.files,
              playerElement: this.playerElement,
              autoplay: true,
              peerTubeLink: false
            },
            peertubeComment: {
              comments: [
                {
                  color: '#f00',
                  position: 'top',
                  size: 0.1,
                  text: 'Top',
                  time: 0
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0.1
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0.2
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0.3
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0.4
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0.5
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0.6
                }, {
                  color: '#000',
                  position: 'auto',
                  size: 0.1,
                  text: 'meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow meow',
                  time: 0.7
                }, {
                  color: '#f00',
                  position: 'bottom',
                  size: 0.1,
                  text: 'PEERTUBE AMAZING',
                  time: 0.5
                }
              ],
              width: '--width',
              height: '--height'
            }
          }
        }

        this.videoPlayerLoaded = true

        const self = this
        videojs(this.playerElement, videojsOptions, function () {
          self.player = this
          this.on('customError', (event, data) => {
            self.handleError(data.err)
          })

          this.on('torrentInfo', (event, data) => {
            self.downloadSpeed = data.downloadSpeed
            self.numPeers = data.numPeers
            self.uploadSpeed = data.uploadSpeed
          })
        })

        this.setVideoDescriptionHTML()

        this.setOpenGraphTags()
        this.checkUserRating()

        this.prepareViewAdd()
      }
    )
  }

  private updateVideoRating (oldRating: UserVideoRateType, newRating: VideoRateType) {
    let likesToIncrement = 0
    let dislikesToIncrement = 0

    if (oldRating) {
      if (oldRating === 'like') likesToIncrement--
      if (oldRating === 'dislike') dislikesToIncrement--
    }

    if (newRating === 'like') likesToIncrement++
    if (newRating === 'dislike') dislikesToIncrement++

    this.video.likes += likesToIncrement
    this.video.dislikes += dislikesToIncrement
  }

  private setOpenGraphTags () {
    this.metaService.setTitle(this.video.name)

    this.metaService.setTag('og:type', 'video')

    this.metaService.setTag('og:title', this.video.name)
    this.metaService.setTag('name', this.video.name)

    this.metaService.setTag('og:description', this.video.description)
    this.metaService.setTag('description', this.video.description)

    this.metaService.setTag('og:image', this.video.previewPath)

    this.metaService.setTag('og:duration', this.video.duration.toString())

    this.metaService.setTag('og:site_name', 'PeerTube')

    this.metaService.setTag('og:url', window.location.href)
    this.metaService.setTag('url', window.location.href)
  }

  private prepareViewAdd () {
    // After 30 seconds (or 3/4 of the video), increment add a view
    let viewTimeoutSeconds = 30
    if (this.video.duration < viewTimeoutSeconds) viewTimeoutSeconds = (this.video.duration * 3) / 4

    setTimeout(() => {
      this.videoService
        .viewVideo(this.video.uuid)
        .subscribe()

    }, viewTimeoutSeconds * 1000)
  }
}
