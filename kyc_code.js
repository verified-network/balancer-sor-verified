import React, {useState, useEffect} from "react";
import { useWeb3React } from "@web3-react/core";
import { walletconnect, injected } from "../../components/common/walletConnect/connectors";
import VerticallyModal from "../../components/modal/VerticallyModal";
import SumsubWebSdk from "@sumsub/websdk-react";
import HelperModal from "./helperModal";

export const fetchSumsubAccessToken = async (account, networkId) => {
    const response = await axios.get(`https://verified-kyc.azurewebsites.net/api/sumsub?account=${account}&networkId=${networkId}`)
    .then((response) => {return response.data});
    return {
      accessToken: response.token,
    }
}

function SumsubModal(props) {
  const context = useWeb3React();
  const { account } = context;  
  const [showHelperModal, setShowHelperModal] = useState(false);
  const [showPassbaseModal, setShowPassbaseModal] = useState(true);
  return (
    <>
    {
      <VerticallyModal
        key="passBaseModal"
        modalHeading="Verify Your Identity"
        showModal={showPassbaseModal}
        modalOnHide={()=>{setShowPassbaseModal(false)}}
        modalSize={"lg"}
        closeButton={false}
        withFooter={false}
      >
        <SumsubWebSdk
            //props.accessToken used here is same as we get from  fetchSumsubAccessToken()
          accessToken={props.accessToken}
          expirationHandler={() => (Promise.resolve(fetchSumsubAccessToken(account)).accessToken)} // same token we get from fetchSumsubAccessToken()
          config={{
            lang: "ru-RU",
            i18n: {
              document: {
                subTitles: {
                  IDENTITY: "Upload a document that proves your identity"
                }
              }
            },
            onMessage: (type, payload) => {
              console.log("WebSDK onMessage", type, payload);
            },
            uiConf: {
              customCssStr:
                ":root {\n  --black: #000000;\n   --grey: #F5F5F5;\n  --grey-darker: #B2B2B2;\n  --border-color: #DBDBDB;\n}\n\np {\n  color: var(--black);\n  font-size: 16px;\n  line-height: 24px;\n}\n\nsection {\n  margin: 40px auto;\n}\n\ninput {\n  color: var(--black);\n  font-weight: 600;\n  outline: none;\n}\n\nsection.content {\n  background-color: var(--grey);\n  color: var(--black);\n  padding: 40px 40px 16px;\n  box-shadow: none;\n  border-radius: 6px;\n}\n\nbutton.submit,\nbutton.back {\n  text-transform: capitalize;\n  border-radius: 6px;\n  height: 48px;\n  padding: 0 30px;\n  font-size: 16px;\n  background-image: none !important;\n  transform: none !important;\n  box-shadow: none !important;\n  transition: all 0.2s linear;\n}\n\nbutton.submit {\n  min-width: 132px;\n  background: none;\n  background-color: var(--black);\n}\n\n.round-icon {\n  background-color: var(--black) !important;\n  background-image: none !important;\n}"
            },
            onError: (error) => {
              console.error("WebSDK onError", error);
            }
          }}
          options={{ addViewportTag: false, adaptIframeHeight: true }}
          onMessage={(type, payload) => {
            console.log("onMessage", type, payload);
            if(type === "idCheck.applicantStatus")
            {
              if(payload.reviewStatus === "pending" || payload.reviewStatus === "completed")
              {
                setShowPassbaseModal(false);
                setShowHelperModal(true);
              }
            }
          }}
          onError={(data) => console.log("onError", data)}
        />
      </VerticallyModal>
    }
    {showHelperModal && <HelperModal setshowKYCModal={props.setshowKYCModal}/>}
    </>
  );
}

export default function KYCModal(props) {
  return <SumsubModal {...props} />;
}