//The login is handled through Biconomy’s integration with Web3Auth - 
//we simply need to initialize the Biconomy SDK and set up the smart account for the user.
import { BiconomySmartAccount, BiconomySmartAccountConfig } from "@biconomy/account";
import { Fragment, useEffect, useRef, useState } from "react";
import SocialLogin from "@biconomy/web3-auth";
import { ethers, providers } from "ethers";
import { ChainId } from "@biconomy/core-types";
import { bundler, paymaster } from "@/constants";
import Transfer from "./Transfer";

//Define a React component Wallet and add state variables
//& useEffect that waits for the Biconomy SDK to be init and then
//triggers the setup of a new smart account
export default function Wallet() {

    const sdkRef = useRef<SocialLogin | null>(null);
    const [interval, enableInterval] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [, setProvider] = useState<providers.Web3Provider>();
    const [smartAccount, setSmartAccount] = useState<BiconomySmartAccount>();

    // Login function - this is what will run when the user attempts to sign-in to our app, 
    //and init the SocialLogin SDK on the Polygon Mumbai test net. Will also start the interval defines earlier
    async function login() {
        
        //If the SDK has not been init yet, init it
        if (!sdkRef.current) {
            const socialLoginSDK = new SocialLogin();
            await socialLoginSDK.init({
                chainId:ethers.utils.hexValue(ChainId.POLYGON_MUMBAI).toString(),
                network: "testnet",
            });
            sdkRef.current = socialLoginSDK;
        }

        // If the SDK is set up, but the provider is not set,
        // start the timer to set up a smart contract

        if (!sdkRef.current.provider) {
            sdkRef.current.showWallet();
            enableInterval(true);
        } else {
            console.log("hello");
            setupSmartAccount();
        }
    }

    async function logOut() {
        // Log out of the smart account
        await sdkRef.current?.logout();

        //Hide the wallet
        sdkRef.current?.hideWallet();

        //Reset state and stop the interval if it was started
        setSmartAccount(undefined);
        enableInterval(false);
    }


    async function setupSmartAccount() {
        try {
            //If the SDK hasn't fully initialized return early
            if (!sdkRef.current?.provider) return;

            //Hide the wallet if currently open
            sdkRef.current.hideWallet();

            //Start the loading indicator
            setLoading(true);

            //Initialize the smart contract
            let web3Provider = new ethers.providers.Web3Provider(
                sdkRef.current?.provider
            );
            setProvider(web3Provider);
            const config: BiconomySmartAccountConfig = {
                signer: web3Provider.getSigner(),
                chainId: ChainId.POLYGON_MUMBAI,
                bundler: bundler,
                paymaster: paymaster,
            };
            const smartAccount = new BiconomySmartAccount(config);
            await smartAccount.init();

            //Save the smart account to a state variable
            setSmartAccount(smartAccount);
            
        } catch (e) {
            console.log(e);
        }

        setLoading(false);
    }

    useEffect(() => {
        let configureLogin: NodeJS.Timeout | undefined;
        if (interval) {
            configureLogin = setInterval(() => {
                if (!!sdkRef.current?.provider) {
                    setupSmartAccount();
                    clearInterval(configureLogin);
                }
            }, 1000);
        }
    }, [interval]);

    return (
        <Fragment>
            {/*logout Button */}
            {smartAccount && (
                <button
                    onClick={login}
                    className="absolute right-0 m-3 rounded-lg bg-gradient-to-r from-green-400
                     to-blue-500 px-4 py-2 font-medium transition-all hover:from-green-500 
                     hover:to-blue-600"
                >
                    Logout
                </button>
            )}

            <div className="m-auto flex h-screen flex-col items-center
            justify-center gap-10 bg-gray-950">
                <h1 className="text-4xl text-gray-50 font-bold tracking-tight lg:text-5xl">
                    Send ERC20 using ERC20
                </h1>

                {/* Login button */}
                {!smartAccount && !loading && (
                    <button
                        onClick={login}
                        className="mt-10 rounded-lg bg-gradient-to-r from-green-400 to-blue-500
                        px-4 py-2 font-medium  transition-colors hover:from-green-500 hover:to-blue-600"
                    >
                        Login
                    </button>
                )}

                {/* Loading state */}
                {loading && <p>Loading account details...</p>}
                
                {smartAccount && (
                    <Fragment>
                        <Transfer smartAccount={smartAccount}/>
                    </Fragment>
                )}
            </div>
        </Fragment>
    );
}