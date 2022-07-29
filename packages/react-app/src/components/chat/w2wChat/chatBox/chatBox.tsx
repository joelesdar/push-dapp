import React, { useState, useContext, useEffect, useRef, ChangeEvent } from 'react'
import './chatBox.css'
// @ts-ignore
import epnsLogo from '../w2wAsset/epnsLogo.png'
import { Context } from '../w2wIndex'
import Chats from '../chats/chats'
import { envConfig } from '@project/contracts'
import 'font-awesome/css/font-awesome.min.css'
import Picker from 'emoji-picker-react'
import * as PushNodeClient from '../../../../api'
import Dropdown from '../dropdown/dropdown'
import { intitializeDb } from '../w2wIndexeddb'
import * as IPFSHelper from '../../../../helpers/w2w/IPFS'
import { CID, IPFSHTTPClient } from 'ipfs-http-client'
import { MessageIPFS } from '../../../../helpers/w2w/IPFS'
import Loader from 'react-loader-spinner'
import GifIcon from '../W2WIcons/GifIcon'
import { Web3Provider } from 'ethers/providers'
import { useWeb3React } from '@web3-react/core'
import Snackbar from '@mui/material/Snackbar'
import MuiAlert, { AlertProps } from '@mui/material/Alert'
import { fetchInbox } from '../w2wUtils'
import GifPicker from '../Gifs/gifPicker'
import { useQuery } from 'react-query'
import { caip10ToWallet } from '../../../../helpers/w2w'
import ScrollToBottom from 'react-scroll-to-bottom'
import { AppContextInterface } from '../../../../components/chat/w2wChat/w2wIndex'
import _ from 'lodash'

const INFURA_URL = envConfig.infuraApiUrl

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />
})

const ChatBox = (): JSX.Element => {
  const { account } = useWeb3React<Web3Provider>()
  const { currentChat, viewChatBox, did, renderInbox, connectedUser, setChat }: AppContextInterface = useContext<
    AppContextInterface
  >(Context)
  const [newMessage, setNewMessage] = useState<string>('')
  const [textAreaDisabled, setTextAreaDisabled] = useState<boolean>(false)
  const [showEmojis, setShowEmojis] = useState<boolean>(false)
  const [Loading, setLoading] = useState<boolean>(true)
  const [messages, setMessages] = useState<MessageIPFS[]>([])
  const [imageSource, setImageSource] = useState<string>('')
  const [hasIntent, setHasIntent] = useState<boolean>(true)
  const [wallets, setWallets] = useState<string[]>([])
  const [filesUploading, setFileUploading] = useState<boolean>(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isGifPickerOpened, setIsGifPickerOpened] = useState<boolean>(false)
  const [intentSentandPending, setIntentSentandPending] = useState<string>('')
  const [openReprovalSnackbar, setOpenSuccessSnackBar] = useState<boolean>(false)
  const { data, error, isError, isLoading } = useQuery<any>('current')
  const [SnackbarText, setSnackbarText] = useState<string>('')
  let showTime = false
  let time = ''

  const getMessagesFromCID = async (messageCID: string, ipfs: IPFSHTTPClient): Promise<void> => {
    if (!messageCID) {
      return
    }
    setMessages([])
    while (messageCID) {
      const getMessage: any = await intitializeDb<string>('Read', 2, 'CID_store', messageCID, '', 'cid')

      let msgIPFS: MessageIPFS
      if (getMessage !== undefined) {
        msgIPFS = getMessage.body
      } else {
        const current = await IPFSHelper.get(messageCID, ipfs) // {}
        await intitializeDb<MessageIPFS>('Insert', 2, 'CID_store', messageCID, current, 'cid')
        msgIPFS = current as MessageIPFS
      }
      // console.log(getMessage, msgIPFS)
      setMessages((m) => [msgIPFS, ...m])

      const link = msgIPFS.link
      if (link) {
        messageCID = link
      } else {
        break
      }
    }
  }

  useEffect(() => {
    function updateData(): void {
      if (data !== undefined && currentChat?.wallets) {
        const newData = data?.filter((x: any) => x?.wallets === currentChat?.wallets)[0]
        if (newData?.intent === 'Approved') {
          setChat(newData)
        }
      }
    }
    const interval = setInterval(() => updateData(), 2000)
    return () => {
      clearInterval(interval)
    }
  }, [data, currentChat?.wallets])

  useEffect(() => {
    const getMessagesFromIPFS = async (): Promise<void> => {
      setNewMessage('')
      setLoading(true)
      let hasintent = false
      if (currentChat) {
        try {
          CID.parse(currentChat.profile_picture) // Will throw exception if invalid CID
          setImageSource(INFURA_URL + `${currentChat.profile_picture}`)
        } catch (err) {
          setImageSource(currentChat.profile_picture)
        }
        const intentStatus = await PushNodeClient.getIntent(currentChat.did, did.id)
        setIntentSentandPending(intentStatus.intent)
        hasintent = intentStatus.hasIntent
        setHasIntent(intentStatus.hasIntent)

        if (currentChat?.threadhash && hasintent) {
          const IPFSClient: IPFSHTTPClient = IPFSHelper.createIPFSClient()
          await getMessagesFromCID(currentChat.threadhash, IPFSClient)
        } else {
          setMessages([])
        }
        const walletsResult: string[] = await PushNodeClient.getDidLinkWallets(currentChat.did)
        setWallets(walletsResult)
        setLoading(false)
      }
    }
    getMessagesFromIPFS().catch((err) => console.error(err))
  }, [currentChat])

  const sendMessage = async (
    account: string,
    fromDid: string,
    toDid: string,
    message: string,
    messageType: string,
    signature: string,
    sigType: string,
    encType: string
  ): Promise<void> => {
    try {
      console.log('connectedUser', connectedUser)
      console.log('currentChat', currentChat)
      console.log('Public Key from Current Chat: ', currentChat.public_key)
      // const fromPGPPrivateKey: string = await DIDHelper.decrypt(JSON.parse(connectedUser.pgp_priv_enc), did);
      // const cipherText: string = await PGP.encryptMessage(message, currentChat.public_key, fromPGPPrivateKey) as string;
      const cipherText = message
      const msg = await PushNodeClient.postMessage(
        account,
        fromDid,
        toDid,
        cipherText,
        messageType,
        signature,
        'encType',
        'sigType'
      )
      setMessages([...messages, msg])
      setNewMessage('')
      const threadhash = await PushNodeClient.getLatestThreadhash(currentChat.did, did.id)
      await intitializeDb<MessageIPFS>('Insert', 2, 'CID_store', threadhash, msg, 'cid')
      const inbox = await fetchInbox(did)
      renderInbox(inbox)
    } catch (error) {
      console.log(error)
    }
  }

  const handleSubmit = _.debounce((e: { preventDefault: () => void }): void => {
    e.preventDefault()
    if (newMessage.trim() !== '') {
      if (hasIntent && intentSentandPending === 'Approved') {
        sendMessage(account, did.id, currentChat.did, newMessage, 'Text', 'signature', 'sigType', 'encType')
      } else {
        sendIntent(newMessage, 'Text')
      }
    }
  }, 2000)

  const sendIntent = async (content: string, contentType: string): Promise<void> => {
    try {
      if (!hasIntent && intentSentandPending === 'Pending') {
        const msg = await PushNodeClient.createIntent(
          currentChat.did,
          did.id,
          account,
          content,
          contentType,
          'signature',
          'myencryptiontype',
          'mysignaturetype'
        )
        console.log(msg)
        setHasIntent(true)
        setMessages([...messages, msg])
        setNewMessage('')
      } else {
        setNewMessage('')
        setOpenSuccessSnackBar(true)
        setSnackbarText('Cannot send message, Intent is not approved!')
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleKeyPress = (e): void => {
    const x = e.keyCode
    if (x === 13) {
      handleSubmit(e)
    }
  }

  const textOnChange = (e): void => {
    setNewMessage(e.target.value)
  }

  const uploadFile = async (file: File): Promise<void> => {
    try {
      const TWO_MB = 1024 * 1024 * 2
      if (file.size > TWO_MB) {
        setOpenSuccessSnackBar(true)
        setSnackbarText('Files larger than 2mb is now allowed')
        return
      }
      setFileUploading(true)
      const IPFSClient: IPFSHTTPClient = IPFSHelper.createIPFSClient()
      const type = file.type.startsWith('image') ? 'Image' : 'File'
      let content: string
      console.log(file)
      if (type === 'File') {
        const reader = new FileReader()
        let resultingfile
        reader.readAsDataURL(file)
        reader.onloadend = async (e): Promise<void> => {
          resultingfile = { content: e.target.result, name: file.name, type: file.type, size: file.size }
          console.log(resultingfile)
          if (!hasIntent && intentSentandPending === 'Pending') {
            sendIntent(JSON.stringify(resultingfile), type)
          } else {
            sendMessage(
              account,
              did.id,
              currentChat.did,
              JSON.stringify(resultingfile),
              type,
              'sig',
              'sig_type',
              'enc_type'
            )
          }
          setFileUploading(false)
        }
      } else {
        const cid = await IPFSHelper.uploadImage(file, IPFSClient)
        content = cid
        if (!hasIntent && intentSentandPending === 'Pending') {
          sendIntent(content.toString(), type)
        } else {
          sendMessage(account, did.id, currentChat.did, content.toString(), type, 'sig', 'sig_type', 'enc_type')
        }
        setFileUploading(false)
      }
    } catch (err) {
      console.log(err)
    }
  }
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }
  const addEmoji = (e, emojiObject: { emoji: any }): void => {
    setNewMessage(newMessage + emojiObject.emoji)
    setShowEmojis(false)
  }

  const sendGif = (url: string): void => {
    console.log(url)
    if (!hasIntent && intentSentandPending === 'Pending') {
      sendIntent(url, 'GIF')
    } else {
      sendMessage(account, did.id, currentChat.did, url, 'GIF', 'signature', 'sig_type', 'enc_type')
    }
  }
  const handleCloseSuccessSnackbar = (event?: React.SyntheticEvent | Event, reason?: string): void => {
    if (reason === 'clickaway') {
      return
    }
    setOpenSuccessSnackBar(false)
  }
  const placeholderTextArea = (): string => {
    if (intentSentandPending === 'Pending' && hasIntent === true) {
      return "Can't send any messages until intent is accepted !"
    }
    if (hasIntent === true && intentSentandPending === 'Approved') return 'New Text Message'
    else return 'Intent Message'
  }

  return (
    <div className="chatBox_body">
      {!viewChatBox ? (
        <div className="defaultChatPage">
          <div className="defaultChatPageText">
            <img src={epnsLogo} alt="" />
            <p>W2W DAPP</p>
            <span>Start a conversation by clicking on any dicussion!</span>
          </div>
        </div>
      ) : (
        <>
          <Snackbar open={openReprovalSnackbar} autoHideDuration={6000} onClose={handleCloseSuccessSnackbar}>
            <Alert onClose={handleCloseSuccessSnackbar} severity="error" sx={{ width: '100%' }}>
              {SnackbarText}
            </Alert>
          </Snackbar>
          <div className="chatBoxNavBar">
            <div className="chatBoxUserName">
              <img src={imageSource} alt="" />
              <div className="chatBoxNavDetail">
                <p className="chatBoxWallet">{caip10ToWallet(currentChat.msg.name)}</p>
                <div>{hasIntent ? <Dropdown wallets={wallets} /> : null}</div>
              </div>
            </div>
          </div>

          <ScrollToBottom className="chatBoxTop">
            {Loading ? (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                <Loader type="Oval" color="#34C5F3" height={40} width={40} />
              </div>
            ) : (
              <>
                {hasIntent ? (
                  messages?.map((msg, i) => {
                    const isLast = i === messages.length - 1
                    const noTail = !isLast && messages[i + 1]?.fromDID === msg.fromDID

                    showTime = false
                    if (i >= 0) {
                      const duration = new Date(messages[i]?.timestamp)
                      const dateString = duration.toDateString()
                      if (dateString !== time || i === 0) {
                        showTime = true
                        time = dateString
                      }
                    }
                    console.log(msg)
                    return (
                      <>
                        {!showTime ? null : (
                          <div className="showDateInChat" key={msg?.timestamp}>
                            <span>{time}</span>
                          </div>
                        )}
                        <Chats msg={msg} did={did} noTail={noTail} key={msg?.timestamp} />
                      </>
                    )
                  })
                ) : (
                  <div className="askForIntent">
                    <p>Ask for Intent to send messages</p>
                  </div>
                )}
              </>
            )}
          </ScrollToBottom>

          <div className="chatBoxBottom">
            {(!hasIntent && intentSentandPending === 'Pending') ||
            (hasIntent && intentSentandPending === 'Approved') ? (
              <>
                <label>
                  <i className="fa fa-2x fa-camera"></i>
                  <input
                    type="file"
                    id="inputTag"
                    className="chatBoxBottomInput"
                    ref={imageInputRef}
                    accept="image/*"
                    onChange={handleFileInputChange}
                  />
                </label>
                <label>
                  <i className="fa fa-link" aria-hidden="true"></i>
                  <input
                    type="file"
                    id="inputTag"
                    className="chatBoxBottomInput"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                  />
                </label>

                <div className="gifPicker">
                  {isGifPickerOpened ? <GifPicker setIsOpened={setIsGifPickerOpened} onSelect={sendGif} /> : null}
                  <button className="GifIcon_btn" onClick={() => setIsGifPickerOpened(true)}>
                    <GifIcon />
                  </button>
                </div>
              </>
            ) : null}
            {hasIntent && intentSentandPending === 'Pending' ? (
              <textarea
                disabled
                className="chatMessageInput"
                placeholder={placeholderTextArea()}
                onKeyDown={handleKeyPress}
                onChange={textOnChange}
                value={newMessage}
              ></textarea>
            ) : (
              <textarea
                disabled={textAreaDisabled}
                className="chatMessageInput"
                placeholder={placeholderTextArea()}
                onKeyDown={handleKeyPress}
                onChange={textOnChange}
                value={newMessage}
                autoFocus
              ></textarea>
            )}
            {(!hasIntent && intentSentandPending === 'Pending') ||
            (hasIntent && intentSentandPending === 'Approved') ? (
              <button
                disabled={textAreaDisabled}
                className="emojiButton"
                onClick={(): void => setShowEmojis(!showEmojis)}
              >
                <i className="fa fa-smile" aria-hidden="true"></i>
              </button>
            ) : null}
            {showEmojis && (
              <Picker
                onEmojiClick={addEmoji}
                pickerStyle={{ width: '20%', position: 'absolute', top: '13rem', zindex: '700', left: '60vw' }}
              />
            )}
            {filesUploading ? (
              <div className="imageloader">
                <Loader type="Oval" color="#3467eb" height={20} width={20} />
              </div>
            ) : (
              <button className="chatSubmitButton" onClick={handleSubmit}>
                <i className="fa fa-paper-plane" aria-hidden="true"></i>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
export default ChatBox
