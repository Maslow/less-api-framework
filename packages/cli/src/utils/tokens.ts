
import * as fs from 'node:fs'
import { AUTH_FILE } from '../utils/constants'
import { getApplicationByAppid } from '../api/apps'
import { getAppData } from './util'

import { CREDENTIALS_DIR,AUTH_FILE} from '../utils/constants'

export async function getAccessToken(){

    try{
        fs.accessSync(CREDENTIALS_DIR, fs.constants.R_OK|fs.constants.W_OK)
    }catch(err){
        console.error("please login first")
        process.exit(1)
    }

    const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));

    const currentTime =  Math.floor(Date.now() / 1000)
    if(currentTime>authData.expire_time){
        console.log("access_token expire,please login")
        process.exit(1)
    }

    return  authData.access_token
}


/**
 * get debug token
 * @returns
 */
export async function getDebugToken() {
    const appData = getAppData()
    const response = await getApplicationByAppid(appData.appid)
    return response.data.debug_token

}
