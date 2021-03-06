import { UserRight } from './user-right.enum'
import user from '../../../server/models/account/user'

// Keep the order
export enum UserRole {
  ADMINISTRATOR = 0,
  MODERATOR = 1,
  USER = 2
}

export const USER_ROLE_LABELS = {
  [UserRole.USER]: 'User',
  [UserRole.MODERATOR]: 'Moderator',
  [UserRole.ADMINISTRATOR]: 'Administrator'
}

// TODO: use UserRole for key once https://github.com/Microsoft/TypeScript/issues/13042 is fixed
const userRoleRights: { [ id: number ]: UserRight[] } = {
  [UserRole.ADMINISTRATOR]: [
    UserRight.ALL
  ],

  [UserRole.MODERATOR]: [
    UserRight.MANAGE_VIDEO_BLACKLIST,
    UserRight.MANAGE_VIDEO_ABUSES,
    UserRight.REMOVE_ANY_VIDEO,
    UserRight.REMOVE_ANY_VIDEO_CHANNEL
  ],

  [UserRole.USER]: []
}

export function hasUserRight (userRole: UserRole, userRight: UserRight) {
  const userRights = userRoleRights[userRole]

  return userRights.indexOf(UserRight.ALL) !== -1 || userRights.indexOf(userRight) !== -1
}
