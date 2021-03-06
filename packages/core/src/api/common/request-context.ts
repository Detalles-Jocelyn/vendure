import { LanguageCode } from '@vendure/common/lib/generated-types';
import { ID, JsonCompatible } from '@vendure/common/lib/shared-types';
import { TFunction } from 'i18next';

import { CachedSession } from '../../config/session-cache/session-cache-strategy';
import { Channel } from '../../entity/channel/channel.entity';

import { ApiType } from './get-api-type';

export type SerializedRequestContext = {
    _session: JsonCompatible<Required<CachedSession>>;
    _apiType: ApiType;
    _channel: JsonCompatible<Channel>;
    _languageCode: LanguageCode;
    _isAuthorized: boolean;
    _authorizedAsOwnerOnly: boolean;
};

/**
 * @description
 * The RequestContext holds information relevant to the current request, which may be
 * required at various points of the stack.
 *
 * It is a good practice to inject the RequestContext (using the {@link Ctx} decorator) into
 * _all_ resolvers & REST handlers, and then pass it through to the service layer.
 *
 * This allows the service layer to access information about the current user, the active language,
 * the active Channel, and so on. In addition, the {@link TransactionalConnection} relies on the
 * presence of the RequestContext object in order to correctly handle per-request database transactions.
 *
 * @example
 * ```TypeScript
 * \@Query()
 * myQuery(\@Ctx() ctx: RequestContext) {
 *   return this.myService.getData(ctx);
 * }
 * ```
 * @docsCategory request
 */
export class RequestContext {
    private readonly _languageCode: LanguageCode;
    private readonly _channel: Channel;
    private readonly _session?: CachedSession;
    private readonly _isAuthorized: boolean;
    private readonly _authorizedAsOwnerOnly: boolean;
    private readonly _translationFn: TFunction;
    private readonly _apiType: ApiType;

    /**
     * @internal
     */
    constructor(options: {
        apiType: ApiType;
        channel: Channel;
        session?: CachedSession;
        languageCode?: LanguageCode;
        isAuthorized: boolean;
        authorizedAsOwnerOnly: boolean;
        translationFn?: TFunction;
    }) {
        const { apiType, channel, session, languageCode, translationFn } = options;
        this._apiType = apiType;
        this._channel = channel;
        this._session = session;
        this._languageCode = languageCode || (channel && channel.defaultLanguageCode);
        this._isAuthorized = options.isAuthorized;
        this._authorizedAsOwnerOnly = options.authorizedAsOwnerOnly;
        this._translationFn = translationFn || (((key: string) => key) as any);
    }

    /**
     * @description
     * Creates an "empty" RequestContext object. This is only intended to be used
     * when a service method must be called outside the normal request-response
     * cycle, e.g. when programmatically populating data.
     */
    static empty(): RequestContext {
        return new RequestContext({
            apiType: 'admin',
            authorizedAsOwnerOnly: false,
            channel: new Channel(),
            isAuthorized: true,
        });
    }

    /**
     * @description
     * Creates a new RequestContext object from a serialized object created by the
     * `serialize()` method.
     */
    static deserialize(ctxObject: SerializedRequestContext): RequestContext {
        return new RequestContext({
            apiType: ctxObject._apiType,
            channel: new Channel(ctxObject._channel),
            session: {
                ...ctxObject._session,
                expires: ctxObject._session?.expires && new Date(ctxObject._session.expires),
            },
            languageCode: ctxObject._languageCode,
            isAuthorized: ctxObject._isAuthorized,
            authorizedAsOwnerOnly: ctxObject._authorizedAsOwnerOnly,
        });
    }

    /**
     * @description
     * Serializes the RequestContext object into a JSON-compatible simple object.
     * This is useful when you need to send a RequestContext object to another
     * process, e.g. to pass it to the Worker process via the {@link WorkerService}.
     */
    serialize(): SerializedRequestContext {
        return JSON.parse(JSON.stringify(this));
    }

    /**
     * @description
     * Creates a shallow copy of the RequestContext instance. This means that
     * mutations to the copy itself will not affect the original, but deep mutations
     * (e.g. copy.channel.code = 'new') *will* also affect the original.
     */
    copy(): RequestContext {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }

    get apiType(): ApiType {
        return this._apiType;
    }

    get channel(): Channel {
        return this._channel;
    }

    get channelId(): ID {
        return this._channel.id;
    }

    get languageCode(): LanguageCode {
        return this._languageCode;
    }

    get session(): CachedSession | undefined {
        return this._session;
    }

    get activeUserId(): ID | undefined {
        return this.session?.user?.id;
    }

    /**
     * @description
     * True if the current session is authorized to access the current resolver method.
     */
    get isAuthorized(): boolean {
        return this._isAuthorized;
    }

    /**
     * @description
     * True if the current anonymous session is only authorized to operate on entities that
     * are owned by the current session.
     */
    get authorizedAsOwnerOnly(): boolean {
        return this._authorizedAsOwnerOnly;
    }

    /**
     * @description
     * Translate the given i18n key
     */
    translate(key: string, variables?: { [k: string]: any }): string {
        try {
            return this._translationFn(key, variables);
        } catch (e) {
            return `Translation format error: ${e.message}). Original key: ${key}`;
        }
    }
}
