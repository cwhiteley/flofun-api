import User from './model'
import { createToken } from '../auth/createToken'
import { facebookAuth } from './utils/facebookAuth'
import { googleAuth } from './utils/googleAuth'
import config from '../../config/config'
import twilio from '../../config/twilio'

export const authFacebook = async (req, res) => auth(req.body.token, res, facebookAuth)

export const authGoogle = async (req, res) => auth(req.body.token, res, googleAuth)

const auth = async (token, res, callback) => {
  try {
    const userInfo = await callback(token)
    let user = await User.findOne({
      providerId: userInfo.providerId,
    })
    if (!user) {
      user = await User.create(userInfo)
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
      token: `JWT ${createToken(user)}`,
    })
  } catch (err) {
    return res.status(400).json({ error: true, errorMessage: err.message })
  }
}

export const authPhone = async (req, res) => {
  if (!req.body.phone) {
    return res.status(422).send({ error: 'You must provide a phone number' })
  }

  const phone = String(req.body.phone).replace(/[^\d]/g, '')
  const code = Math.floor((Math.random() * 8999 + 1000)) // eslint-disable-line

  try {
    let user = await User.findOne({
      providerId: phone,
    })
    if (!user) {
      user = await User.create({
        phone,
        providerId: phone,
        provider: 'phone',
      })
    }

    await twilio.messages.create({
      body: `Welcome to FLOFUN, your code is ${code}`,
      to: phone,
      from: config.twilio.twilioPhone,
    })

    await User.update({ _id: user._id }, { $set: { code, codeValid: true } })

    res.send({ success: true })
  } catch (err) {
    return res.status(400).json({ error: true, errorMessage: err.message })
  }
}

export const validateCode = async (req, res) => {
  if (!req.body.phone || !req.body.code) {
    return res.status(422).send({ error: 'Phone and Code must be provided' })
  }

  const phone = String(req.body.phone).replace(/[^\d]/g, '')
  const code = parseInt(req.body.code, 10)

  try {
    const user = await User.findOne({
      providerId: phone,
    })

    if (!user) {
      return res.status(400).json({ error: true, errorMessage: 'user not found' })
    }

    if (user.code !== code || !user.codeValid) {
      return res.status(200).send({ invalidCode: true })
    }

    await User.update({ _id: user._id }, { $set: { codeValid: false } })

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
      token: `JWT ${createToken(user)}`,
    })
  } catch (err) {
    return res.status(400).json({ error: true, errorMessage: err.message })
  }
}
