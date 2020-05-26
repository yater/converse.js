import { CustomElement } from './element.js';
import { __ } from '@converse/headless/i18n';
import { _converse } from "@converse/headless/converse-core";
import { html } from 'lit-element';


const i18n_nickname = __('Nickname');
const i18n_join = __('Enter groupchat');

const i18n_heading = _converse.muc_show_logs_before_join ?
    __('Choose a nickname to enter') :
    __('Please choose your nickname');


class NicknameForm extends CustomElement {

    static get properties () {
        return {
            nickname: { type: String }
        }
    }

    render() {
        return html`
            <div class="chatroom-form-container muc-nickname-form">
                <form class="converse-form chatroom-form converse-centered-form">
                    <fieldset class="form-group">
                        <label>${i18n_heading}</label>
                        <input type="text" required="required" name="nick" value="${this.nickname}"
                            class="form-control {{this.error_class}}" placeholder="${i18n_nickname}"/>
                    </fieldset>
                    <fieldset class="form-group">
                        <input type="submit" class="btn btn-primary" name="join" value="${i18n_join}"/>
                    </fieldset>
                </form>
            </div>
        `;
    }
}

customElements.define('converse-nickname-form', NicknameForm);
